/**
 * Analytics Service — MyTaskly
 *
 * Wrapper centralizzato attorno a Vexo Analytics.
 * Tutti gli eventi dell'app passano da qui per garantire
 * naming coerente e type safety.
 *
 * API Vexo:
 *   vexo(apiKey)             — inizializzazione
 *   identifyDevice(id)       — identifica utente/dispositivo
 *   customEvent(name, args)  — traccia evento custom
 *   enableTracking()         — abilita tracking (default: attivo)
 *   disableTracking()        — disabilita tracking
 */

import { vexo, identifyDevice, customEvent } from 'vexo-analytics';

// ─────────────────────────────────────────────────────────────
// Dev guard — in development tutti gli eventi vengono ignorati
// per non sporcare le analisi e per evitare crash da moduli
// nativi non linkati (es. NativeModules.RNVexo undefined).
// ─────────────────────────────────────────────────────────────

const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

// ─────────────────────────────────────────────────────────────
// Costanti
// ─────────────────────────────────────────────────────────────

const VEXO_API_KEY = 'd9ba61c5-0c0d-413f-98d8-e277b45d3d32';

// Nomi evento — usare SEMPRE queste costanti per evitare typo
export const ANALYTICS_EVENTS = {
  // Navigazione
  SCREEN_VIEW: 'screen_view',

  // Sessione / tempo di utilizzo
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',

  // Auth
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',

  // Onboarding
  TUTORIAL_COMPLETED: 'tutorial_completed',
  TUTORIAL_SKIPPED: 'tutorial_skipped',

  // Chat testuale
  TEXT_CHAT_MESSAGE_SENT: 'text_chat_message_sent',
  TEXT_CHAT_RESPONSE_RECEIVED: 'text_chat_response_received',
  TEXT_CHAT_ERROR: 'text_chat_error',

  // Chat vocale
  VOICE_CHAT_SESSION_STARTED: 'voice_chat_session_started',
  VOICE_CHAT_SESSION_ENDED: 'voice_chat_session_ended',
  VOICE_CHAT_RESPONSE_RECEIVED: 'voice_chat_response_received',
  VOICE_CHAT_ERROR: 'voice_chat_error',
  VOICE_CHAT_RECONNECT: 'voice_chat_reconnect',

  // Google Calendar
  GOOGLE_CALENDAR_CONNECTED: 'google_calendar_connected',
  GOOGLE_CALENDAR_DISCONNECTED: 'google_calendar_disconnected',
  GOOGLE_CALENDAR_SYNCED: 'google_calendar_synced',

  // Offline
  OFFLINE_OPERATION: 'offline_operation',
  OFFLINE_SYNC_COMPLETED: 'offline_sync_completed',

  // Errori
  ERROR: 'error',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ─────────────────────────────────────────────────────────────
// Inizializzazione
// ─────────────────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;

/**
 * Inizializza Vexo. Deve essere chiamato UNA SOLA VOLTA all'avvio dell'app,
 * prima del rendering del NavigationContainer.
 */
export function initAnalytics(): Promise<void> {
  if (IS_DEV) {
    console.log('[ANALYTICS] Dev mode — tracking disabilitato');
    return Promise.resolve();
  }
  if (initPromise) return initPromise;
  initPromise = Promise.resolve(vexo(VEXO_API_KEY))
    .then(() => { console.log('[ANALYTICS] Vexo inizializzato'); })
    .catch((e) => { console.warn('[ANALYTICS] Errore inizializzazione Vexo:', e); });
  return initPromise;
}

// ─────────────────────────────────────────────────────────────
// Identificazione dispositivo / utente
// ─────────────────────────────────────────────────────────────

/**
 * Associa un ID utente al dispositivo corrente.
 * Chiamare dopo ogni login riuscito.
 */
export async function identifyUser(userId: string): Promise<void> {
  if (IS_DEV || !initPromise) return;
  await initPromise;
  try {
    await identifyDevice(userId);
  } catch (e) {
    console.warn('[ANALYTICS] Errore identifyDevice:', e);
  }
}

export async function resetUserIdentity(): Promise<void> {
  if (IS_DEV || !initPromise) return;
  await initPromise;
  try {
    await identifyDevice(null);
  } catch (e) {
    console.warn('[ANALYTICS] Errore reset identifyDevice:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Tracking generico
// ─────────────────────────────────────────────────────────────

/**
 * Traccia un evento con proprietà opzionali.
 */
export function trackEvent(
  event: AnalyticsEvent | string,
  properties?: Record<string, string | number | boolean>
): void {
  if (IS_DEV) return;
  if (!initPromise) return;
  initPromise.then(() => {
    try {
      customEvent(event, properties ?? {});
    } catch (e) {
      console.warn(`[ANALYTICS] Errore track(${event}):`, e);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Helper specializzati
// ─────────────────────────────────────────────────────────────

// ────── Navigazione ──────

/**
 * Traccia la navigazione verso uno schermo.
 * Utilizzato da NavigationHandler in navigation/index.tsx
 */
export function trackScreenView(screenName: string): void {
  trackEvent(ANALYTICS_EVENTS.SCREEN_VIEW, { screen_name: screenName });
}

// ────── Sessione ──────

let sessionStartTime: number | null = null;

export function trackSessionStart(): void {
  sessionStartTime = Date.now();
  trackEvent(ANALYTICS_EVENTS.SESSION_START, {
    timestamp: new Date().toISOString(),
  });
}

export function trackSessionEnd(): void {
  const duration = sessionStartTime
    ? Math.round((Date.now() - sessionStartTime) / 1000)
    : 0;
  trackEvent(ANALYTICS_EVENTS.SESSION_END, { duration_seconds: duration });
  sessionStartTime = null;
}

// ────── Auth ──────

export function trackLoginSuccess(method: 'email' | 'google'): void {
  trackEvent(ANALYTICS_EVENTS.LOGIN_SUCCESS, { method });
}

export function trackLoginFailed(method: 'email' | 'google', reason?: string): void {
  trackEvent(ANALYTICS_EVENTS.LOGIN_FAILED, {
    method,
    reason: reason ?? 'unknown',
  });
}

// ────── Onboarding ──────

export function trackTutorialCompleted(): void {
  trackEvent(ANALYTICS_EVENTS.TUTORIAL_COMPLETED);
}

export function trackTutorialSkipped(): void {
  trackEvent(ANALYTICS_EVENTS.TUTORIAL_SKIPPED);
}

// ────── Chat testuale ──────

export function trackTextMessageSent(model: 'base' | 'advanced'): void {
  trackEvent(ANALYTICS_EVENTS.TEXT_CHAT_MESSAGE_SENT, { model });
}

/**
 * Traccia una risposta ricevuta dalla chat testuale.
 * @param durationMs tempo dall'invio alla prima risposta
 */
export function trackTextResponseReceived(
  durationMs: number,
  model: 'base' | 'advanced'
): void {
  trackEvent(ANALYTICS_EVENTS.TEXT_CHAT_RESPONSE_RECEIVED, {
    duration_ms: durationMs,
    model,
  });
}

export function trackTextChatError(errorMessage: string): void {
  trackEvent(ANALYTICS_EVENTS.TEXT_CHAT_ERROR, { error: errorMessage });
}

// ────── Chat vocale ──────

let voiceSessionStartTime: number | null = null;
let voiceSpeechStoppedTime: number | null = null;

export function trackVoiceChatStarted(): void {
  voiceSessionStartTime = Date.now();
  trackEvent(ANALYTICS_EVENTS.VOICE_CHAT_SESSION_STARTED);
}

export function trackVoiceChatEnded(): void {
  const duration = voiceSessionStartTime
    ? Math.round((Date.now() - voiceSessionStartTime) / 1000)
    : 0;
  trackEvent(ANALYTICS_EVENTS.VOICE_CHAT_SESSION_ENDED, {
    duration_seconds: duration,
  });
  voiceSessionStartTime = null;
  voiceSpeechStoppedTime = null;
}

/** Chiamare quando il VAD di OpenAI rileva la fine del parlato */
export function markVoiceSpeechStopped(): void {
  voiceSpeechStoppedTime = Date.now();
}

/**
 * Traccia il tempo di risposta della chat vocale.
 * Chiamare quando arriva il primo chunk audio dal server.
 * Calcola la latenza dalla fine del parlato dell'utente.
 */
export function trackVoiceResponseTime(): void {
  if (voiceSpeechStoppedTime) {
    const latencyMs = Date.now() - voiceSpeechStoppedTime;
    trackEvent(ANALYTICS_EVENTS.VOICE_CHAT_RESPONSE_RECEIVED, {
      latency_ms: latencyMs,
    });
    voiceSpeechStoppedTime = null;
  }
}

export function trackVoiceChatError(errorMessage: string): void {
  trackEvent(ANALYTICS_EVENTS.VOICE_CHAT_ERROR, { error: errorMessage });
}

export function trackVoiceChatReconnect(attempt: number): void {
  trackEvent(ANALYTICS_EVENTS.VOICE_CHAT_RECONNECT, { attempt });
}

// ────── Google Calendar ──────

export function trackGoogleCalendarConnected(): void {
  trackEvent(ANALYTICS_EVENTS.GOOGLE_CALENDAR_CONNECTED);
}

export function trackGoogleCalendarDisconnected(): void {
  trackEvent(ANALYTICS_EVENTS.GOOGLE_CALENDAR_DISCONNECTED);
}

export function trackGoogleCalendarSynced(
  direction: 'tasks_to_calendar' | 'calendar_to_tasks' | 'full',
  createdCount: number,
  updatedCount: number
): void {
  trackEvent(ANALYTICS_EVENTS.GOOGLE_CALENDAR_SYNCED, {
    direction,
    created_count: createdCount,
    updated_count: updatedCount,
  });
}

// ────── Offline ──────

export function trackOfflineOperation(
  operationType: 'CREATE' | 'UPDATE' | 'DELETE'
): void {
  trackEvent(ANALYTICS_EVENTS.OFFLINE_OPERATION, {
    operation_type: operationType,
  });
}

export function trackOfflineSyncCompleted(processedCount: number): void {
  trackEvent(ANALYTICS_EVENTS.OFFLINE_SYNC_COMPLETED, {
    processed_count: processedCount,
  });
}

// ────── Errori ──────

export function trackError(
  errorMessage: string,
  context?: string,
  isFatal = false
): void {
  trackEvent(ANALYTICS_EVENTS.ERROR, {
    error: errorMessage,
    context: context ?? 'unknown',
    is_fatal: isFatal,
  });
}
