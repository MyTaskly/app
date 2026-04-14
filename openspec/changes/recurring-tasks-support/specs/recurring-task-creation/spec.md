## ADDED Requirements

### Requirement: Create/edit recurring task modal
The app SHALL provide a `CreateRecurringTaskModal` that collects all fields required by the server and submits them via `recurringTaskService`.

#### Scenario: Create mode
- **WHEN** the modal is opened with no `taskId` prop
- **THEN** it SHALL render a blank form and call `createRecurringTask(payload)` on submit

#### Scenario: Edit mode
- **WHEN** the modal is opened with a valid `taskId` prop
- **THEN** it SHALL pre-fill all fields from the existing recurring task and call `updateRecurringTask(taskId, payload)` on submit

### Requirement: Recurrence type selector
The modal SHALL present a mutually exclusive choice between "custom interval (minutes)" and "recurrence pattern (daily/weekly/monthly)".

#### Scenario: Custom interval selected
- **WHEN** the user selects "Custom Interval"
- **THEN** only `interval_minutes` field SHALL be visible and the `recurrence_pattern` fields SHALL be hidden; the submitted payload SHALL include `interval_minutes` and omit `recurrence_pattern`

#### Scenario: Pattern selected
- **WHEN** the user selects "Daily", "Weekly", or "Monthly"
- **THEN** the `recurrence_pattern` fields SHALL be shown and `interval_minutes` SHALL be hidden; the submitted payload SHALL include `recurrence_pattern` and omit `interval_minutes`

### Requirement: Days of week picker for weekly pattern
The modal SHALL show a day-of-week multi-selector only when `recurrence_pattern === "weekly"`.

#### Scenario: Weekly pattern selected, no days chosen
- **WHEN** the user picks "Weekly" but selects no days
- **THEN** the submit button SHALL be disabled and an inline validation message SHALL be shown

#### Scenario: Weekly pattern with days selected
- **WHEN** at least one day is selected
- **THEN** the submitted payload SHALL include `days_of_week` as an integer array (1=Mon … 7=Sun)

### Requirement: End condition selector
The modal SHALL allow the user to choose among three end conditions: "Never", "After N occurrences", "On date".

#### Scenario: Never
- **WHEN** `end_type === "never"` is selected
- **THEN** `end_count` and `end_date` fields SHALL be hidden; the payload SHALL send `end_type: "never"` with both fields as null

#### Scenario: After count
- **WHEN** `end_type === "after_count"` is selected
- **THEN** a numeric input for `end_count` SHALL be shown; submit SHALL be blocked if `end_count` is empty or less than 1

#### Scenario: On date
- **WHEN** `end_type === "on_date"` is selected
- **THEN** a date picker for `end_date` SHALL be shown; submit SHALL be blocked if `end_date` is null

### Requirement: Priority and category selection
The modal SHALL include a priority picker ("Bassa", "Media", "Alta") and an optional category picker consistent with the rest of the app.

#### Scenario: Default priority
- **WHEN** the modal opens in create mode
- **THEN** `priority` SHALL default to "Media"

### Requirement: Start time field
The modal SHALL include a date/time picker for `start_time`.

#### Scenario: Default start time
- **WHEN** the modal opens in create mode
- **THEN** `start_time` SHALL default to the current date/time rounded to the next full hour

### Requirement: Form validation before submit
The modal SHALL validate required fields before calling the service.

#### Scenario: Missing title
- **WHEN** the title field is empty on submit
- **THEN** an inline error SHALL be shown and the network request SHALL NOT be made

#### Scenario: Successful submission
- **WHEN** all required fields are valid and the user taps submit
- **THEN** the modal SHALL call the appropriate service method, close on success, and the recurring tasks list SHALL refresh
