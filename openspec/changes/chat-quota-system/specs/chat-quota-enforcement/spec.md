## ADDED Requirements

### Requirement: Handle HTTP 429 in text chat
The text chat send handler SHALL catch HTTP `429` responses from `POST /chat/text` and display an inline error message in the chat thread. The message SHALL include the plan name and quota reset date. The system SHALL NOT retry automatically on 429.

#### Scenario: Text quota exceeded
- **WHEN** the user sends a text message and the server responds with HTTP `429`
- **THEN** an inline bot-style message appears in the chat: "Hai raggiunto il limite mensile di messaggi per il tuo piano {PLAN}. I contatori si resettano il {RESET_DATE}."
- **AND** the message includes a tappable CTA that navigates to the Plan & Usage screen
- **AND** the send button remains accessible (user is not locked out permanently)

#### Scenario: No automatic retry on 429
- **WHEN** the server returns `429`
- **THEN** the client does NOT resend the message automatically

### Requirement: Handle WebSocket close code 4029 in voice chat
The voice WebSocket handler SHALL detect the `{"type":"error","message":"Voice request quota exceeded..."}` frame and the close code `4029`, and SHALL display a quota-exceeded modal. The system SHALL NOT attempt automatic reconnection after a `4029` close.

#### Scenario: Voice quota exceeded — error frame received
- **WHEN** the WebSocket receives a JSON frame with `type === "error"` and a message containing "quota exceeded"
- **THEN** the voice session ends and a modal is shown: "Hai esaurito le richieste vocali mensili per il piano {PLAN}. Puoi continuare a usare la chat testuale."
- **AND** the modal includes a CTA to navigate to the Plan & Usage screen

#### Scenario: Voice quota exceeded — close code 4029
- **WHEN** the WebSocket closes with code `4029`
- **THEN** the voice session ends and the same quota-exceeded modal is shown
- **AND** the client does NOT attempt to reconnect

#### Scenario: Normal WebSocket close is unaffected
- **WHEN** the WebSocket closes with any code other than `4029`
- **THEN** existing reconnect and error-handling logic is unchanged
