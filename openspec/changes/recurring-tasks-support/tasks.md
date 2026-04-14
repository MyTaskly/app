## 1. Types & Service Layer

- [x] 1.1 Define `RecurringTask` TypeScript interface in `src/services/recurringTaskService.ts` matching the full `RecurringTaskOut` server schema
- [x] 1.2 Define `CreateRecurringTaskPayload` and `UpdateRecurringTaskPayload` request types
- [x] 1.3 Implement `listRecurringTasks(options?: { activeOnly?: boolean })` using `GET /tasks/recurring/`
- [x] 1.4 Implement `getRecurringTask(id: number)` using `GET /tasks/recurring/{id}`
- [x] 1.5 Implement `createRecurringTask(payload)` with client-side validation (weekly + days_of_week, at least one of interval_minutes/recurrence_pattern)
- [x] 1.6 Implement `updateRecurringTask(id, payload)` using `PATCH /tasks/recurring/{id}`
- [x] 1.7 Implement `deleteRecurringTask(id)` using `DELETE /tasks/recurring/{id}`
- [x] 1.8 Implement `completeRecurringTask(id)` using `POST /tasks/recurring/{id}/complete`
- [x] 1.9 Export a singleton `RecurringTaskService` instance following the project's singleton pattern

## 2. Calendar Sync Fix

- [x] 2.1 Update `googleCalendarService.ts` to handle the new `/calendar/sync` response fields (`tasks_synced`, `recurring_tasks_synced`, `skipped_count`, `deleted_count`, `errors`) and remove references to the old `created_count` field
- [x] 2.2 Update any UI that displays the calendar sync result to show both `tasks_synced` and `recurring_tasks_synced` counts

## 3. RecurringTaskCard Component

- [x] 3.1 Create `src/components/RecurringTaskCard.tsx` displaying title, next occurrence date (locale-formatted), priority badge, and category
- [x] 3.2 Add active/inactive visual states (greyed out + no Complete button when `is_active === false`)
- [x] 3.3 Add "Complete" button that calls `completeRecurringTask` and updates local state optimistically
- [x] 3.4 Add Google Calendar icon indicator when `google_calendar_event_id` is present
- [x] 3.5 Handle exhausted state display (`is_active: false`, `next_occurrence: null`) with a "Finished" badge

## 4. Recurring Tasks List Screen

- [x] 4.1 Create `src/navigation/screens/RecurringTasksScreen.tsx` with `FlatList` of `RecurringTaskCard` components
- [x] 4.2 Implement loading + error states and pull-to-refresh
- [x] 4.3 Add empty-state UI prompting the user to create their first recurring task
- [x] 4.4 Add "Active only" toggle switch that re-fetches with `activeOnly: true`
- [x] 4.5 Add a "+" / "New Recurring Task" button in the screen header that opens `CreateRecurringTaskModal`

## 5. Create/Edit Recurring Task Modal

- [x] 5.1 Create `src/components/CreateRecurringTaskModal.tsx` accepting optional `taskId` prop (null = create mode, number = edit mode)
- [x] 5.2 Add title text input with inline validation (required)
- [x] 5.3 Add description text input (optional)
- [x] 5.4 Add start time date/time picker defaulting to next full hour
- [x] 5.5 Add priority picker with options "Bassa", "Media" (default), "Alta"
- [x] 5.6 Add category picker using existing categories from `taskService.getCategories()`
- [x] 5.7 Add recurrence type segment control: "Custom Interval" vs "Pattern"
- [x] 5.8 Add `interval_minutes` numeric input (shown only when "Custom Interval" is selected)
- [x] 5.9 Add `recurrence_pattern` picker (daily/weekly/monthly) shown only when "Pattern" is selected
- [x] 5.10 Add `interval` (every N units) numeric input shown when pattern mode is active
- [x] 5.11 Add `days_of_week` multi-select (Mon–Sun) shown only when `recurrence_pattern === "weekly"`; enforce at least one day selected
- [x] 5.12 Add end condition selector: "Never" / "After N occurrences" / "On date"
- [x] 5.13 Show `end_count` numeric input when "After N occurrences" is selected with min=1 validation
- [x] 5.14 Show `end_date` date picker when "On date" is selected
- [x] 5.15 Pre-fill all fields in edit mode by calling `getRecurringTask(taskId)` on modal open
- [x] 5.16 On submit, call `createRecurringTask` or `updateRecurringTask`, close modal on success, and refresh the list

## 6. Navigation Wiring

- [x] 6.1 Add `RecurringTasksScreen` to `RootStackParamList` in `src/navigation/index.tsx`
- [x] 6.2 Register the screen in the navigation stack
- [x] 6.3 Add a "Recurring Tasks" entry point button/icon in the task list header or main task screen so users can reach `RecurringTasksScreen`
