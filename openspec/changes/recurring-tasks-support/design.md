## Context

The MyTaskly backend has replaced `/recurring-tasks/` with `/tasks/recurring/`. The new model exposes **one object per recurring task** (not multiple instances): a single card with `next_occurrence` tells the user when the task will fire next. Completing an occurrence is a dedicated action (`POST /tasks/recurring/{id}/complete`) that advances `next_occurrence` automatically.

The mobile app currently has no recurring task support. The Google Calendar sync endpoint changed its response shape from `{created_count, skipped_count}` to `{tasks_synced, recurring_tasks_synced, skipped_count, deleted_count, errors}`.

Constraints from CLAUDE.md:
- No EAS builds autonomously
- Existing axios instance (`axiosInstance.ts`) with JWT interceptors
- Singleton/lazy-init pattern for new services
- Tab navigation via `TabParamList` in `src/navigation/index.tsx`

## Goals / Non-Goals

**Goals:**
- Full TypeScript interface for `RecurringTask` matching `RecurringTaskOut` server schema
- `recurringTaskService.ts` with all 6 operations: list, get, create, update, delete, complete
- Screen listing recurring tasks with next occurrence and active/inactive states
- Create/Edit modal supporting all recurrence types (interval_minutes, daily/weekly/monthly, end conditions)
- Complete-occurrence action from the list
- Fix `googleCalendarService.ts` to handle new `/calendar/sync` response shape

**Non-Goals:**
- Showing a timeline/calendar view of future occurrences (server exposes one object per task, not instances)
- Push notification scheduling for recurring tasks (deferred to a follow-up)
- Offline queue support for recurring task mutations (out of scope for this change)

## Decisions

### D1: One service file, no new dependencies
Use the existing `axiosInstance` (already handles auth headers, base URL, interceptors). No new HTTP libraries needed.

**Alternatives considered:** Wrapping in React Query — rejected, the app uses manual state management and event emitters; adding RQ would be a larger architectural shift.

### D2: Singleton service pattern
`RecurringTaskService` follows the same singleton pattern as `TaskCacheService` and `SyncManager`. This is consistent with the codebase and avoids multiple instantiation.

### D3: New tab vs. stack screen for the list
Add a navigation entry point as a **stack screen** accessible from the main Task list or Settings, rather than a new bottom tab. The bottom tab bar is already crowded (Home, Tasks, AI, Calendar, Settings). A tab-less entry avoids cluttering the primary navigation.

**Alternative:** Add as a tab — rejected to keep the tab count manageable.

### D4: Single modal for create + edit
The `CreateRecurringTaskModal` doubles as an edit form. The same fields and validation logic apply to both create and update. A `taskId` prop distinguishes the mode; null means create.

### D5: Dynamic field visibility in the creation form
- Show `days_of_week` picker only when `recurrence_pattern === "weekly"`
- Show `end_count` input only when `end_type === "after_count"`
- Show `end_date` picker only when `end_type === "on_date"`
- Show `interval_minutes` field when the user opts for a custom minute interval

This reduces cognitive load and avoids invalid combinations.

## Risks / Trade-offs

- **Calendar sync response mismatch** → check `googleCalendarService.ts` usage of old field names (`created_count`) and update all callsites; no runtime guard needed since the new shape is stable.
- **`days_of_week` validation on the client** → if the user picks "weekly" but selects no days, the server returns 422. The modal must enforce at least one day is selected before enabling submit.
- **`is_active: false` tasks in the list** → display them visually distinct (greyed out) but keep them visible by default; add a toggle to hide finished recurring tasks.
- **`interval_minutes` vs `recurrence_pattern` mutual exclusivity** → in the form, use a radio/segment control to pick "custom interval (minutes)" vs "pattern (daily/weekly/monthly)". Only one group sends its value; the other is omitted from the request body.

## Migration Plan

1. Deploy changes to the mobile app (no server-side migration needed — server already live).
2. Old `/recurring-tasks/` calls are removed; no backwards-compatibility shim needed because the endpoints 404 on the current server.
3. `googleCalendarService.ts` change is non-breaking in isolation (the calendar sync screen shows different count labels).

## Open Questions

- Should the recurring tasks list be accessible from the main task screen (e.g., a banner/button) or only via a dedicated navigation item? → Proposed: add a "Recurring" entry to the task list header actions.
