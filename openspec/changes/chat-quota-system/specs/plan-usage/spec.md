## ADDED Requirements

### Requirement: Fetch user plan and quota data
The system SHALL provide a `planService.ts` that calls `GET /auth/me/plan` with the user's Bearer token and API key, returning plan name, text/voice usage counters, and reset date.

#### Scenario: Successful fetch
- **WHEN** `planService.getUserPlan()` is called with a valid token
- **THEN** it returns an object with `plan`, `text_messages_limit`, `text_messages_used`, `voice_requests_limit`, `voice_requests_used`, and `reset_date`

#### Scenario: Network or auth failure
- **WHEN** the request fails (network error or 401)
- **THEN** `planService.getUserPlan()` throws an error that the caller can handle

### Requirement: Display plan and usage in Settings
The Settings screen SHALL display a "Piano & Utilizzo" section that shows the user's current plan, text and voice usage progress bars, and the quota reset date. The section SHALL be populated by calling `planService.getUserPlan()` on screen mount.

#### Scenario: Data loaded successfully
- **WHEN** the Settings screen mounts and the plan fetch succeeds
- **THEN** the screen displays the plan badge (e.g. "FREE"), two progress bars (text messages and voice requests) with used/limit labels, and the reset date formatted as a localized date string

#### Scenario: FREE plan shown with upgrade CTA
- **WHEN** the fetched plan is `"FREE"`
- **THEN** an "Upgrade" CTA button is visible below the usage section

#### Scenario: ENTERPRISE plan — unlimited display
- **WHEN** either `text_messages_limit` or `voice_requests_limit` is >= 9999
- **THEN** the corresponding counter displays "Illimitato" instead of a numeric limit and the progress bar is hidden

#### Scenario: Loading state
- **WHEN** the plan fetch is in progress
- **THEN** placeholder/skeleton UI is shown for the usage section

#### Scenario: Fetch error
- **WHEN** the plan fetch fails
- **THEN** a retry button or error message is shown; the rest of Settings remains usable
