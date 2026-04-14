## Why

The backend now exposes a dedicated recurring tasks API (`/tasks/recurring/`) where each recurring task is a single object with a `next_occurrence` field — replacing the old `/recurring-tasks/` endpoints that are no longer available. Without updating the mobile app, users cannot create, view, or complete recurring tasks.

## What Changes

- Add a `recurringTaskService.ts` that wraps all new `/tasks/recurring/` endpoints (CRUD + complete)
- Add a `RecurringTasksScreen` listing recurring tasks with their next occurrence and active status
- Add a `CreateRecurringTaskModal` / form for creating new recurring tasks (all field types: interval_minutes, recurrence_pattern, days_of_week, end_type)
- Add a "complete occurrence" action on each recurring task card (calls `POST /tasks/recurring/{id}/complete`)
- Update `googleCalendarService.ts` to handle the new `/calendar/sync` response shape (`tasks_synced`, `recurring_tasks_synced`, `skipped_count`, `deleted_count`, `errors`)
- **BREAKING**: Remove any references to the old `/recurring-tasks/` endpoints

## Capabilities

### New Capabilities

- `recurring-task-api`: Client-side service layer for all `/tasks/recurring/` REST operations (list, create, get, update, delete, complete occurrence)
- `recurring-tasks-ui`: Screens and components for viewing the recurring task list and completing occurrences
- `recurring-task-creation`: Form UI with full field support for creating/editing recurring tasks (pattern, interval, days_of_week, end conditions)

### Modified Capabilities

<!-- no existing spec-level capabilities changing -->

## Impact

- **New file**: `src/services/recurringTaskService.ts`
- **New file**: `src/navigation/screens/RecurringTasksScreen.tsx`
- **New file**: `src/components/RecurringTaskCard.tsx`
- **New file**: `src/components/CreateRecurringTaskModal.tsx`
- **Modified**: `src/services/googleCalendarService.ts` — adapt to new `/calendar/sync` response fields
- **Navigation**: Add recurring tasks entry point (tab or stack screen) in `src/navigation/index.tsx`
- **Types**: New `RecurringTask` TypeScript interface matching `RecurringTaskOut` schema
- **No new dependencies required** — existing axios instance handles API calls
