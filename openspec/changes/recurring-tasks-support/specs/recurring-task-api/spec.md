## ADDED Requirements

### Requirement: RecurringTask TypeScript interface
The app SHALL define a `RecurringTask` interface that matches the server's `RecurringTaskOut` schema exactly, including all nullable fields.

#### Scenario: Interface covers all server fields
- **WHEN** the server returns a `RecurringTaskOut` object
- **THEN** the TypeScript interface SHALL accept it without type errors, including `id`, `user_id`, `category_id`, `title`, `description`, `start_time`, `priority`, `interval_minutes`, `recurrence_pattern`, `interval`, `days_of_week`, `end_type`, `end_date`, `end_count`, `occurrence_count`, `next_occurrence`, `last_completed_at`, `is_active`, `google_calendar_event_id`, `extra_config`, `created_at`, `updated_at`

### Requirement: List recurring tasks
The service SHALL expose a method to fetch all recurring tasks for the authenticated user from `GET /tasks/recurring/`.

#### Scenario: Fetch active tasks only
- **WHEN** `listRecurringTasks({ activeOnly: true })` is called
- **THEN** the service SHALL append `?active_only=true` to the request URL

#### Scenario: Fetch all tasks
- **WHEN** `listRecurringTasks()` is called without arguments
- **THEN** the service SHALL call `GET /tasks/recurring/` without any query param

### Requirement: Get single recurring task
The service SHALL expose a method to fetch one recurring task by ID from `GET /tasks/recurring/{id}`.

#### Scenario: Task not found
- **WHEN** the server returns 404
- **THEN** the service SHALL propagate the error to the caller

### Requirement: Create recurring task
The service SHALL expose a method to create a recurring task via `POST /tasks/recurring/`.

#### Scenario: interval_minutes provided
- **WHEN** the payload includes `interval_minutes`
- **THEN** `recurrence_pattern` SHALL be omitted from the request body (interval_minutes takes precedence)

#### Scenario: weekly pattern without days_of_week
- **WHEN** `recurrence_pattern === "weekly"` and `days_of_week` is empty or absent
- **THEN** the service SHALL throw a validation error before making the network request

### Requirement: Update recurring task
The service SHALL expose a method to partially update a recurring task via `PATCH /tasks/recurring/{id}`.

#### Scenario: Pattern change triggers next_occurrence recalculation
- **WHEN** the PATCH request includes a new `recurrence_pattern` or `interval`
- **THEN** the server recalculates `next_occurrence`; the service SHALL return the updated object from the response

### Requirement: Delete recurring task
The service SHALL expose a method to delete a recurring task via `DELETE /tasks/recurring/{id}`.

#### Scenario: Successful deletion
- **WHEN** the server returns 204
- **THEN** the service SHALL resolve the promise without a return value

### Requirement: Complete current occurrence
The service SHALL expose a method to mark the current occurrence as done via `POST /tasks/recurring/{id}/complete`.

#### Scenario: Successful completion
- **WHEN** the server returns 200 with an updated `RecurringTaskOut`
- **THEN** the service SHALL return the updated object including the new `next_occurrence` and incremented `occurrence_count`

#### Scenario: Task exhausted after completion
- **WHEN** the server returns 200 with `is_active: false` and `next_occurrence: null`
- **THEN** the service SHALL return the object as-is; the caller is responsible for updating UI state

### Requirement: Calendar sync response adaptation
The `googleCalendarService.ts` SHALL handle the new `/calendar/sync` response shape.

#### Scenario: New response fields
- **WHEN** `/calendar/sync` returns `{ tasks_synced, recurring_tasks_synced, skipped_count, deleted_count, errors }`
- **THEN** the service SHALL expose all five fields to callers and SHALL NOT reference the old `created_count` field
