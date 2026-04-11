## Context

The server has introduced a monthly quota system for AI chat (text and voice). The app currently has no awareness of user plans or usage limits. The bot service (`src/services/botservice.ts`) sends requests to `POST /chat/text` and opens WebSockets to `/chat/voice-bot-websocket` without handling quota-related error codes. The Settings screen has no plan/usage information.

Current state:
- `botservice.ts` does not read rate-limit response headers
- No `planService` exists
- Text chat catches generic errors but not HTTP 429 specifically
- Voice WebSocket does not differentiate close code 4029 from other failures
- Settings screen has no plan section

## Goals / Non-Goals

**Goals:**
- Introduce `planService.ts` to fetch and cache `GET /auth/me/plan`
- Display plan, text/voice quotas with progress bars, and reset date in Settings
- Handle HTTP `429` in text chat with an inline, localized message and CTA
- Handle WS close `4029` and error frame in voice chat with a modal and CTA
- Show a live `X-RateLimit-Remaining` counter in the chat input area; disable send at 0
- Add all user-facing strings to `en.json` and `it.json`

**Non-Goals:**
- In-app upgrade/payment flow (CTA navigates to Plan screen only)
- Admin plan management UI
- Push notification when quota resets
- Caching plan data across app restarts (re-fetch on open is sufficient)

## Decisions

### D1 — New `planService.ts` instead of extending existing services
Quota data is orthogonal to tasks and auth. A dedicated service keeps concerns separate and is easier to test.
Alternative considered: extending `authService.ts`. Rejected because auth service is already complex and quota data has its own refresh lifecycle.

### D2 — Store remaining counter in React state, not AsyncStorage
`X-RateLimit-Remaining` is up-to-date after every message send. Persisting it across app restarts adds complexity for little gain; `GET /auth/me/plan` on next open gives accurate data.
Alternative: AsyncStorage persistence. Rejected as overkill.

### D3 — Inline error message in chat (not toast) for 429
The server spec explicitly requests an inline error message. This also provides a persistent, tappable CTA to the Plan screen.
Alternative: bottom toast. Rejected per server integration guide.

### D4 — Voice quota modal (not inline) for close 4029
Voice chat UI doesn't have a chat message thread. A modal is the appropriate pattern for a session-ending error.

### D5 — Threshold `>= 9999` treated as unlimited
ENTERPRISE plan returns `999999`. Any value >= 9999 is treated as unlimited in the UI (counter hidden, send never disabled).

### D6 — `X-RateLimit-Remaining` read from SSE/fetch response headers
`botservice.ts` already wraps the `/chat/text` call. The remaining count will be extracted from the response headers at that call site and returned alongside the message response so the caller can update UI state.

## Risks / Trade-offs

- [Risk] SSE streaming responses may not expose headers via the Fetch API in React Native → Mitigation: test on Android/iOS; fall back to `GET /auth/me/plan` if headers are inaccessible in the streaming path.
- [Risk] Plan screen navigation assumes a named route exists → Mitigation: verify route name in `RootStackParamList` before wiring CTAs; add route if missing.
- [Risk] WS close code `4029` may be swallowed by reconnect logic → Mitigation: check existing reconnect guard in `VoiceBotWebSocket` and add an explicit `4029` branch that skips reconnect.

## Migration Plan

No data migration needed. All changes are additive:
1. Add `planService.ts`
2. Update `botservice.ts` (header reading + 429 handling)
3. Update `VoiceBotWebSocket` in `botservice.ts` (4029 handling)
4. Add Plan section to Settings screen
5. Update BotChat screen (inline error + counter + disabled state)
6. Add i18n strings

Rollback: revert the above files. No server-side changes required from the client side.

## Open Questions

- Is there an existing "Plan" or "Subscription" screen in the navigation stack, or must it be created? (Affects CTA navigation target.)
- Does the voice chat UI live in a dedicated screen or is it a modal within BotChat? (Affects where to show the modal.)
