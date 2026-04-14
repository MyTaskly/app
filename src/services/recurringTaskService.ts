import axiosInstance from './axiosInstance';

// ── Types ──────────────────────────────────────────────────────────────────

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly';
export type EndType = 'never' | 'after_count' | 'on_date';
export type Priority = 'Bassa' | 'Media' | 'Alta';

export interface RecurringTask {
  id: number;
  user_id: number;
  category_id: number | null;
  title: string;
  description: string | null;
  start_time: string;
  priority: Priority;
  interval_minutes: number | null;
  recurrence_pattern: RecurrencePattern | null;
  interval: number;
  days_of_week: number[] | null;
  end_type: EndType;
  end_date: string | null;
  end_count: number | null;
  occurrence_count: number;
  next_occurrence: string | null;
  last_completed_at: string | null;
  is_active: boolean;
  google_calendar_event_id: string | null;
  extra_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringTaskPayload {
  title: string;
  description?: string | null;
  start_time: string;
  priority?: Priority;
  category_id?: number | null;
  // Use exactly ONE of the two below:
  interval_minutes?: number;
  recurrence_pattern?: RecurrencePattern;
  interval?: number;
  days_of_week?: number[];
  end_type?: EndType;
  end_count?: number | null;
  end_date?: string | null;
  extra_config?: Record<string, unknown> | null;
}

export interface UpdateRecurringTaskPayload {
  title?: string;
  description?: string | null;
  start_time?: string;
  priority?: Priority;
  category_id?: number | null;
  interval_minutes?: number | null;
  recurrence_pattern?: RecurrencePattern | null;
  interval?: number;
  days_of_week?: number[] | null;
  end_type?: EndType;
  end_count?: number | null;
  end_date?: string | null;
  is_active?: boolean;
  extra_config?: Record<string, unknown> | null;
}

// ── Service ────────────────────────────────────────────────────────────────

class RecurringTaskService {
  private static instance: RecurringTaskService;

  static getInstance(): RecurringTaskService {
    if (!RecurringTaskService.instance) {
      RecurringTaskService.instance = new RecurringTaskService();
    }
    return RecurringTaskService.instance;
  }

  async listRecurringTasks(options?: { activeOnly?: boolean }): Promise<RecurringTask[]> {
    const params = options?.activeOnly ? '?active_only=true' : '';
    const response = await axiosInstance.get<RecurringTask[]>(`/tasks/recurring/${params}`);
    return response.data;
  }

  async getRecurringTask(id: number): Promise<RecurringTask> {
    const response = await axiosInstance.get<RecurringTask>(`/tasks/recurring/${id}`);
    return response.data;
  }

  async createRecurringTask(payload: CreateRecurringTaskPayload): Promise<RecurringTask> {
    if (!payload.interval_minutes && !payload.recurrence_pattern) {
      throw new Error('At least one of interval_minutes or recurrence_pattern is required');
    }
    if (payload.recurrence_pattern === 'weekly' && (!payload.days_of_week || payload.days_of_week.length === 0)) {
      throw new Error('days_of_week is required when recurrence_pattern is "weekly"');
    }

    // If interval_minutes is set it takes precedence — omit recurrence_pattern from body
    const body: Record<string, unknown> = { ...payload };
    if (payload.interval_minutes) {
      delete body.recurrence_pattern;
    }

    const response = await axiosInstance.post<RecurringTask>('/tasks/recurring/', body);
    return response.data;
  }

  async updateRecurringTask(id: number, payload: UpdateRecurringTaskPayload): Promise<RecurringTask> {
    const response = await axiosInstance.patch<RecurringTask>(`/tasks/recurring/${id}`, payload);
    return response.data;
  }

  async deleteRecurringTask(id: number): Promise<void> {
    await axiosInstance.delete(`/tasks/recurring/${id}`);
  }

  async completeRecurringTask(id: number): Promise<RecurringTask> {
    const response = await axiosInstance.post<RecurringTask>(`/tasks/recurring/${id}/complete`, {});
    return response.data;
  }
}

export const recurringTaskService = RecurringTaskService.getInstance();
export default RecurringTaskService;
