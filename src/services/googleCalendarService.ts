import axiosInstance from './axiosInstance';

export interface CalendarSyncStatus {
  google_calendar_connected: boolean;
  total_tasks?: number;
  synced_tasks?: number;
  unsynced_tasks?: number;
  sync_percentage?: number;
  message?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  total: number;
  period: string;
}

export interface SyncResponse {
  message?: string;
  // New /calendar/sync response shape (RRULE events imported as RecurringTask)
  tasks_synced?: number;
  recurring_tasks_synced?: number;
  skipped_count?: number;
  deleted_count?: number;
  errors?: any[];
  // Legacy field — kept for syncTasksToCalendar which uses a different endpoint
  updated_count?: number;
}

export interface AuthorizeResponse {
  authorization_url: string;
  state: string;
  message: string;
}

class GoogleCalendarService {
  private static instance: GoogleCalendarService;

  static getInstance(): GoogleCalendarService {
    if (!GoogleCalendarService.instance) {
      GoogleCalendarService.instance = new GoogleCalendarService();
    }
    return GoogleCalendarService.instance;
  }

  /**
   * Richiede l'URL di autorizzazione OAuth per collegare Google Calendar
   */
  async authorizeCalendar(): Promise<{ success: boolean; data?: AuthorizeResponse; error?: string }> {
    try {
      const response = await axiosInstance.get('/auth/google/calendar/authorize');
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nel recupero URL autorizzazione:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nell\'autorizzazione'
      };
    }
  }

  /**
   * Scollega Google Calendar dall'account
   */
  async disconnectCalendar(): Promise<{ success: boolean; error?: string }> {
    try {
      await axiosInstance.delete('/auth/google/calendar/disconnect');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Errore nella disconnessione:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nella disconnessione'
      };
    }
  }

  /**
   * Verifica lo stato della connessione a Google Calendar
   */
  async getSyncStatus(): Promise<{ success: boolean; data?: CalendarSyncStatus; error?: string }> {
    try {
      const response = await axiosInstance.get('/calendar/status');
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nel recupero dello stato di sincronizzazione:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nel recupero dello stato'
      };
    }
  }

  /**
   * Ottiene gli eventi del calendario per i prossimi giorni
   */
  async getCalendarEvents(daysAhead: number = 30): Promise<{ success: boolean; data?: CalendarEventsResponse; error?: string }> {
    try {
      const response = await axiosInstance.get(`/calendar/events?days_ahead=${daysAhead}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nel recupero degli eventi del calendario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nel recupero degli eventi'
      };
    }
  }

  /**
   * Sincronizza i task verso Google Calendar (batch)
   */
  async syncTasksToCalendar(): Promise<{ success: boolean; data?: SyncResponse; error?: string }> {
    try {
      const response = await axiosInstance.post('/calendar/sync-tasks-to-calendar', {});
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nella sincronizzazione task → calendario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nella sincronizzazione'
      };
    }
  }

  /**
   * Importa eventi da Google Calendar come task MyTaskly (vecchio endpoint)
   */
  async syncCalendarToTasks(daysAhead: number = 30): Promise<{ success: boolean; data?: SyncResponse; error?: string }> {
    try {
      const response = await axiosInstance.post(`/calendar/sync-calendar-to-tasks?days_ahead=${daysAhead}`, {});
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nella sincronizzazione calendario → task:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nella sincronizzazione'
      };
    }
  }

  /**
   * Nuovo endpoint di sincronizzazione unificato.
   * Gli eventi con RRULE vengono importati come RecurringTask.
   * Response: { tasks_synced, recurring_tasks_synced, skipped_count, deleted_count, errors }
   */
  async syncCalendar(daysAhead: number = 30): Promise<{ success: boolean; data?: SyncResponse; error?: string }> {
    try {
      const response = await axiosInstance.post(`/calendar/sync?days_ahead=${daysAhead}`, {});
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nella sincronizzazione calendario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nella sincronizzazione'
      };
    }
  }

  /**
   * Crea un evento calendario da un task specifico
   */
  async createEventFromTask(taskId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await axiosInstance.post(`/calendar/create-event/${taskId}`, {});
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nella creazione evento da task:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nella creazione evento'
      };
    }
  }

  /**
   * Rimuove l'evento calendario associato a un task
   */
  async removeEventFromTask(taskId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await axiosInstance.delete(`/calendar/remove-event/${taskId}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Errore nella rimozione evento da task:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Errore nella rimozione evento'
      };
    }
  }

  /**
   * Esegue una sincronizzazione completa:
   * 1. Esporta tutti i task su Calendar
   * 2. Importa gli eventi del Calendar come task
   */
  async performInitialSync(daysAhead: number = 30): Promise<{ success: boolean; results?: any; error?: string }> {
    try {
      console.log('🔄 Avvio sincronizzazione completa...');

      const taskToCalendarResult = await this.syncTasksToCalendar();
      if (!taskToCalendarResult.success) {
        throw new Error(`Errore sincronizzazione task → calendario: ${taskToCalendarResult.error}`);
      }

      const calendarToTasksResult = await this.syncCalendarToTasks(daysAhead);
      if (!calendarToTasksResult.success) {
        throw new Error(`Errore sincronizzazione calendario → task: ${calendarToTasksResult.error}`);
      }

      console.log('✅ Sincronizzazione completa terminata');

      return {
        success: true,
        results: {
          tasksToCalendar: taskToCalendarResult.data,
          calendarToTasks: calendarToTasksResult.data
        }
      };
    } catch (error: any) {
      console.error('❌ Errore durante la sincronizzazione completa:', error);
      return { success: false, error: error.message || 'Errore durante la sincronizzazione' };
    }
  }
}

export default GoogleCalendarService;
