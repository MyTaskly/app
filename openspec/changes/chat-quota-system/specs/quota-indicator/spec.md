## ADDED Requirements

### Requirement: Live remaining-messages counter in chat UI
After each successful text message send, the chat screen SHALL read the `X-RateLimit-Remaining` header from the response, store it in local state, and display a subtle counter near the chat input. The counter SHALL be hidden for ENTERPRISE users (limit >= 9999).

#### Scenario: Counter updates after successful send
- **WHEN** `POST /chat/text` returns `200 OK` with an `X-RateLimit-Remaining` header
- **THEN** the counter in the chat UI updates to show "{N} messaggi rimasti questo mese"

#### Scenario: Counter hidden for ENTERPRISE users
- **WHEN** the user's `text_messages_limit` is >= 9999
- **THEN** no remaining-messages counter is displayed

#### Scenario: Soft warning at low quota
- **WHEN** `X-RateLimit-Remaining` is <= 5
- **THEN** the counter text changes to a warning style: "Ti restano solo {N} messaggi questo mese."

### Requirement: Disable send button at zero remaining
When `X-RateLimit-Remaining` reaches `0`, the chat send button SHALL be disabled and the exhausted state SHALL be shown (matching the inline error from the chat-quota-enforcement spec).

#### Scenario: Send disabled at quota zero
- **WHEN** `X-RateLimit-Remaining` is `0` (or the last response returned `429`)
- **THEN** the send button is visually disabled and tapping it does not send a message
- **AND** the inline quota-exceeded message is visible in the chat thread

#### Scenario: Send re-enabled after plan refresh
- **WHEN** the user navigates to the Plan & Usage screen and returns to chat
- **THEN** if the quota has been refreshed (new month), the send button becomes active again
