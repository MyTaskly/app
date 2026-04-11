## 1. Plan Service

- [x] 1.1 Create `src/services/planService.ts` with `getUserPlan()` that calls `GET /auth/me/plan` using the existing axios instance (with Bearer token and API key headers)
- [x] 1.2 Define and export `UserPlan` TypeScript interface matching the API response fields
- [x] 1.3 Add localized strings for plan/quota UI to `src/locales/en.json` and `src/locales/it.json` (plan badge labels, progress bar labels, reset date label, upgrade CTA, "Illimitato" text)

## 2. Settings — Plan & Usage Section

- [x] 2.1 Add a "Piano & Utilizzo" section to `src/navigation/screens/Settings.tsx` that calls `planService.getUserPlan()` on mount
- [x] 2.2 Render plan badge (FREE / PRO / ENTERPRISE), two progress bars (text messages and voice requests) with used/limit labels, and formatted reset date
- [x] 2.3 Show "Upgrade" CTA button when `plan === "FREE"`
- [x] 2.4 Display "Illimitato" and hide progress bar when limit >= 9999
- [x] 2.5 Handle loading and error states in the Settings section (skeleton UI + retry button)

## 3. Text Chat — 429 Handling

- [x] 3.1 In the text message send handler (BotChat screen or `botservice.ts`), catch HTTP `429` responses and extract plan name and reset date for the error message
- [x] 3.2 Insert an inline bot-style error message into the chat thread with the localized quota-exceeded text and a tappable CTA that navigates to the Plan & Usage screen (Settings)
- [x] 3.3 Ensure no automatic retry occurs on 429

## 4. Quota Indicator in Chat UI

- [x] 4.1 In `botservice.ts`, extract `X-RateLimit-Remaining` from the `POST /chat/text` response headers and return it alongside the message data
- [x] 4.2 In the BotChat screen, store `remainingMessages` in local state and update it after each successful send
- [x] 4.3 Render the remaining-messages counter near the chat input; apply warning style when <= 5; hide for ENTERPRISE (limit >= 9999)
- [x] 4.4 Disable the send button and show the exhausted state when `remainingMessages === 0` (or last response was 429)

## 5. Voice Chat — 4029 Handling

- [x] 5.1 In `VoiceBotWebSocket` (`src/services/botservice.ts`), add a handler for incoming JSON frames with `type === "error"` containing a quota-exceeded message
- [x] 5.2 Add a handler for WebSocket close code `4029` that suppresses automatic reconnection and invokes a `onVoiceQuotaExceeded` callback
- [x] 5.3 In the voice chat UI (VoiceChat screen or BotChat voice modal), show a modal with the localized voice-quota-exceeded message and a CTA to the Plan & Usage screen when `onVoiceQuotaExceeded` fires
