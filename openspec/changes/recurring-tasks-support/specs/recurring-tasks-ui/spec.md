## ADDED Requirements

### Requirement: Recurring tasks list screen
The app SHALL provide a `RecurringTasksScreen` that displays all recurring tasks for the authenticated user.

#### Scenario: List loads successfully
- **WHEN** the screen mounts
- **THEN** it SHALL call `listRecurringTasks()` and render one `RecurringTaskCard` per task

#### Scenario: Empty state
- **WHEN** the user has no recurring tasks
- **THEN** the screen SHALL display an empty-state message prompting the user to create one

#### Scenario: Pull to refresh
- **WHEN** the user pulls down on the list
- **THEN** the screen SHALL re-fetch the task list from the server

### Requirement: RecurringTaskCard component
The app SHALL provide a `RecurringTaskCard` component that displays a single recurring task's key information.

#### Scenario: Active task display
- **WHEN** `is_active === true` and `next_occurrence` is not null
- **THEN** the card SHALL display the task title, next occurrence date/time formatted in the user's locale, and a "Complete" action button

#### Scenario: Inactive task display
- **WHEN** `is_active === false`
- **THEN** the card SHALL render visually distinct (greyed out / reduced opacity) and SHALL NOT show the "Complete" button

#### Scenario: next_occurrence null with active false
- **WHEN** `is_active === false` and `next_occurrence === null`
- **THEN** the card SHALL display a "Completed" or "Exhausted" badge instead of a date

#### Scenario: Google Calendar imported task
- **WHEN** `google_calendar_event_id` is not null
- **THEN** the card SHALL display a calendar icon indicating the task was imported from Google Calendar

### Requirement: Complete occurrence action
The app SHALL allow the user to mark the current occurrence of a recurring task as done directly from the list.

#### Scenario: Successful completion
- **WHEN** the user taps the "Complete" button on an active task card
- **THEN** the app SHALL call `completeRecurringTask(id)` and update the card to show the new `next_occurrence`

#### Scenario: Task exhausted after completion
- **WHEN** the server responds with `is_active: false`
- **THEN** the card SHALL transition to the inactive visual state without requiring a full list refresh

### Requirement: Navigation to recurring tasks
The app SHALL provide a navigation entry point to `RecurringTasksScreen` accessible from the task management area.

#### Scenario: Access from task list
- **WHEN** the user taps the "Recurring" navigation button in the task list header
- **THEN** the app SHALL navigate to `RecurringTasksScreen`

### Requirement: Show/hide inactive tasks toggle
The app SHALL provide a toggle on `RecurringTasksScreen` to filter out inactive (exhausted or disabled) tasks.

#### Scenario: Toggle hides inactive tasks
- **WHEN** the user enables "Active only" toggle
- **THEN** the screen SHALL call `listRecurringTasks({ activeOnly: true })` and only active tasks SHALL be displayed
