## Why

The server now enforces monthly usage quotas on AI chat (text and voice) per user plan (FREE/PRO/ENTERPRISE). The client must surface quota status, handle exhaustion errors gracefully, and guide users toward upgrading — otherwise users will hit silent failures or confusing errors when their quota runs out.

## What Changes

- **New**: `GET /auth/me/plan` API call to fetch plan info and usage counters
- **New**: Plan & Usage UI section in Settings showing text/voice quotas with progress bars and reset date
- **Modified**: Text chat handler now catches HTTP `429` and shows an inline quota-exceeded message with CTA to Plan screen
- **Modified**: Voice WebSocket handler now catches close code `4029` and error frame `{"type":"error","message":"Voice request quota exceeded..."}`, showing a modal with CTA to Plan screen
- **New**: Live quota counter in chat UI reading `X-RateLimit-Remaining` from response headers; disables send button at 0
- **New**: `planService.ts` service for fetching and caching plan/quota data

## Capabilities

### New Capabilities

- `plan-usage`: Fetch and display user plan info, text/voice quota counters, and reset date from `GET /auth/me/plan`
- `chat-quota-enforcement`: Handle `429` HTTP errors in text chat and WS close code `4029` in voice chat with inline messages and Plan screen CTAs
- `quota-indicator`: Live remaining-messages counter in chat UI derived from `X-RateLimit-Remaining` response headers

### Modified Capabilities

<!-- No existing spec-level requirements are changing; new behavior is additive -->

## Impact

- `src/services/botservice.ts`: Add header reading for `X-RateLimit-Remaining`; handle `429` in text send; handle WS close `4029` and error frame in voice
- `src/navigation/screens/Settings.tsx`: Add Plan & Usage section with progress bars
- `src/navigation/screens/BotChat.tsx` (or equivalent): Show inline quota error, soft warning, disabled send button
- `src/navigation/screens/VoiceChat.tsx` (or equivalent): Show voice quota modal
- New file: `src/services/planService.ts` — wraps `GET /auth/me/plan`
- `src/locales/en.json` / `src/locales/it.json`: Add quota-related strings
- No new native dependencies required
