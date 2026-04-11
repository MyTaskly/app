import { getValidToken } from "./authService";
import { fetch } from 'expo/fetch';
import { ToolWidget } from '../components/BotChat/types';
import {
  trackTextMessageSent,
  trackTextResponseReceived,
  trackTextChatError,
} from './analyticsService';


/**
 * Callback per gestire chunk di testo in streaming + widget tool + chat info
 */
export type StreamingCallback = (
  chunk: string,
  isComplete: boolean,
  toolWidgets?: ToolWidget[],
  chatInfo?: { chat_id: string; is_new: boolean }
) => void;

/**
 * Invia un messaggio testuale al bot e riceve una risposta in streaming
 * Utilizza l'endpoint /chat/text per la chat scritta con supporto streaming
 * @param {string} userMessage - Il messaggio dell'utente da inviare al bot
 * @param {string} modelType - Il tipo di modello da utilizzare ('base' o 'advanced')
 * @param {StreamingCallback} onStreamChunk - Callback per ricevere chunk in streaming + widgets (opzionale)
 * @param {string} chatId - Optional chat ID to identify the chat session
 * @returns {Promise<{text: string, toolWidgets: ToolWidget[], chat_id?: string, is_new?: boolean}>} - La risposta completa del bot con widgets e chat info
 */
export async function sendMessageToBot(
  userMessage: string,
  modelType: "base" | "advanced" = "base",
  onStreamChunk?: StreamingCallback,
  chatId?: string
): Promise<{text: string, toolWidgets: ToolWidget[], chat_id?: string, is_new?: boolean, quotaExceeded?: boolean, remainingMessages?: number, rateLimitReset?: number}> {
  try {
    // Verifica che l'utente sia autenticato
    const token = await getValidToken();
    if (!token) {
      return {
        text: "Mi dispiace, sembra che tu non sia autenticato. Effettua il login per continuare.",
        toolWidgets: [],
      };
    }

    // ── Analytics: traccia invio messaggio ──
    trackTextMessageSent(modelType);
    const messageStartTime = Date.now();

    // Costruisci il payload per la richiesta
    const requestPayload: any = {
      quest: userMessage,
      model: modelType,
    };

    // Aggiungi chat_id se fornito per salvare i messaggi nella cronologia
    if (chatId) {
      requestPayload.chat_id = chatId;
    }

    // Invia la richiesta al server con supporto streaming usando expo fetch
    const response = await fetch("https://taskly-production.up.railway.app/chat/text", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        return {
          text: '',
          toolWidgets: [],
          quotaExceeded: true,
          rateLimitReset: rateLimitReset ? parseInt(rateLimitReset, 10) : undefined,
        };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Read remaining quota from headers before consuming body
    const rateLimitRemainingHeader = response.headers.get('X-RateLimit-Remaining');
    const remainingMessages = rateLimitRemainingHeader !== null ? parseInt(rateLimitRemainingHeader, 10) : undefined;

    if (!response.body) {
      console.log(response)
      throw new Error("Nessun body nella risposta");
    }

    // Processa la risposta in streaming usando ReadableStream con expo/fetch
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullMessage = '';

    // Mappa per tracciare i widget tool (usa item_index come chiave)
    const toolWidgetsMap = new Map<number, ToolWidget>();
    // Mappa per tracciare tool_name per ogni item_index (workaround per tool_name: "unknown")
    const toolNamesMap = new Map<number, string>();
    // Variabili per tracciare chat_id ricevuto dal server
    let receivedChatId: string | undefined;
    let isNewChat: boolean | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decodifica ogni chunk immediatamente
        const text = decoder.decode(value, { stream: true });

        // Dividi il testo per linee per gestire più messaggi JSON
        const lines = text.split('\n').filter((line: string) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: {')) {
            try {
              const jsonStr = line.replace('data: ', '').trim();
              const parsed = JSON.parse(jsonStr);

              // EVENTO: chat_info - Riceve informazioni sulla chat
              if (parsed.type === 'chat_info') {
                receivedChatId = parsed.chat_id;
                isNewChat = parsed.is_new;
                console.log(`[TEXTBOTSERVICE] Chat info ricevuto: chat_id=${receivedChatId}, is_new=${isNewChat}`);

                // Notifica UI del chat_id ricevuto
                if (onStreamChunk) {
                  onStreamChunk('', false, Array.from(toolWidgetsMap.values()), {
                    chat_id: receivedChatId,
                    is_new: isNewChat || false,
                  });
                }
              }

              // EVENTO: tool_call - Crea widget in loading
              if (parsed.type === 'tool_call') {
                // Salva il tool_name per questo item_index
                toolNamesMap.set(parsed.item_index, parsed.tool_name);

                const widgetId = `tool_${parsed.item_index}`;
                const newWidget = {
                  id: widgetId,
                  toolName: parsed.tool_name,
                  status: 'loading' as const,
                  itemIndex: parsed.item_index,
                  toolArgs: parsed.tool_args,
                };
                toolWidgetsMap.set(parsed.item_index, newWidget);

                // Notifica UI del nuovo widget loading
                if (onStreamChunk) {
                  onStreamChunk('', false, Array.from(toolWidgetsMap.values()));
                }
              }

              // EVENTO: tool_output - Aggiorna widget con risultato
              if (parsed.type === 'tool_output') {
                // Usa item_index per trovare il widget (ignora tool_name che può essere "unknown")
                let widget = toolWidgetsMap.get(parsed.item_index);
                let widgetKey = parsed.item_index; // Traccia la chiave corretta del widget

                // WORKAROUND: Se non trova il widget per item_index, cerca per tool_name
                // (il server a volte usa index diversi per tool_call e tool_output)
                if (!widget && parsed.tool_name !== 'unknown') {
                  // Trova widget E la sua chiave originale
                  for (const [key, w] of toolWidgetsMap.entries()) {
                    if (w.toolName === parsed.tool_name && w.status === 'loading') {
                      widget = w;
                      widgetKey = key; // Usa la chiave originale del widget
                      break;
                    }
                  }
                }

                // WORKAROUND 2: Se tool_name è "unknown", cerca l'ultimo widget in loading
                if (!widget && parsed.tool_name === 'unknown') {
                  // Trova l'ultimo widget loading E la sua chiave
                  let lastLoadingKey: number | undefined;
                  for (const [key, w] of toolWidgetsMap.entries()) {
                    if (w.status === 'loading') {
                      widget = w;
                      lastLoadingKey = key;
                    }
                  }
                  if (lastLoadingKey !== undefined) {
                    widgetKey = lastLoadingKey;
                  }
                }

                if (widget) {
                  try {
                    // Parsa l'output JSON del tool
                    let outputData = JSON.parse(parsed.output);

                    // Se l'output è wrappato in {"type":"text","text":"..."}, estrailo
                    if (outputData.type === 'text' && outputData.text) {
                      outputData = JSON.parse(outputData.text);
                    }

                    widget.status = outputData.success !== false ? 'success' : 'error';
                    widget.toolOutput = outputData;
                    widget.errorMessage = outputData.success === false ? outputData.message : undefined;

                    // Usa il tool_name salvato dal tool_call se quello nell'output è "unknown"
                    if (parsed.tool_name === 'unknown' && toolNamesMap.has(widgetKey)) {
                      widget.toolName = toolNamesMap.get(widgetKey)!;
                    }
                  } catch (e: any) {
                    widget.status = 'error';
                    widget.errorMessage = 'Errore parsing output tool';
                    console.error('[TEXTBOTSERVICE] Error parsing tool output:', e);
                  }

                  // IMPORTANTE: Aggiorna il widget nella posizione ORIGINALE, non creare un duplicato
                  toolWidgetsMap.set(widgetKey, widget);

                  // Notifica UI dell'aggiornamento widget
                  if (onStreamChunk) {
                    onStreamChunk('', false, Array.from(toolWidgetsMap.values()));
                  }
                } else {
                  console.warn('[TEXTBOTSERVICE] Widget not found for index:', parsed.item_index);
                }
              }

              // EVENTO: content - Accumula testo messaggio
              if (parsed.type === 'content' && (parsed.delta || parsed.content)) {
                const textChunk = parsed.delta || parsed.content;
                fullMessage += textChunk;

                // Chiama la callback con testo + widgets attuali
                if (onStreamChunk) {
                  onStreamChunk(textChunk, false, Array.from(toolWidgetsMap.values()));
                }
              }

              // EVENTO: error - Marca widgets loading come error
              if (parsed.type === 'error') {
                console.error('Errore streaming:', parsed.message);

                // Marca tutti i widget loading come error
                toolWidgetsMap.forEach((widget) => {
                  if (widget.status === 'loading') {
                    widget.status = 'error';
                    widget.errorMessage = parsed.message || 'Errore sconosciuto';
                  }
                });

                // Notifica UI dell'errore
                if (onStreamChunk) {
                  onStreamChunk('', false, Array.from(toolWidgetsMap.values()));
                }
              }

              // EVENTO: done - Stream completato
              if (parsed.type === 'done') {
                // Stream completato, non serve loggare
              }

            } catch (e: any) {
              console.log("Errore parsing JSON per linea:", line);
              console.log("Errore:", e.message);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Notifica il completamento dello streaming
    if (onStreamChunk) {
      onStreamChunk('', true, Array.from(toolWidgetsMap.values()),
        receivedChatId ? { chat_id: receivedChatId, is_new: isNewChat || false } : undefined
      );
    }

    // ── Analytics: traccia risposta ricevuta ──
    trackTextResponseReceived(Date.now() - messageStartTime, modelType);

    return {
      text: fullMessage || "Nessuna risposta ricevuta dal bot.",
      toolWidgets: Array.from(toolWidgetsMap.values()),
      chat_id: receivedChatId,
      is_new: isNewChat,
      remainingMessages,
    };

  } catch (error: any) {
    console.error("❌ Errore nella comunicazione con il bot:", error);

    // ── Analytics: traccia errore chat testuale ──
    trackTextChatError(error?.message ?? 'unknown');

    let errorMessage = "Mi dispiace, si è verificato un errore. Riprova più tardi.";

    // Gestisci errori specifici per fetch
    if (error.message?.includes('status: 401')) {
      errorMessage = "Sessione scaduta. Effettua nuovamente il login.";
    } else if (error.message?.includes('status: 429')) {
      errorMessage = "Troppe richieste. Riprova tra qualche secondo.";
    } else if (error.message?.includes('status: 5')) {
      errorMessage = "Il servizio è temporaneamente non disponibile. Riprova più tardi.";
    }

    // Ritorna messaggio di errore con widgets vuoti
    return {
      text: errorMessage,
      toolWidgets: [],
    };
  }
}

/**
 * Elimina la cronologia chat dal server
 * @returns {Promise<boolean>} - True se l'eliminazione è andata a buon fine, False altrimenti
 */
export async function clearChatHistory(): Promise<boolean> {
  try {
    // Verifica che l'utente sia autenticato
    const token = await getValidToken();
    if (!token) {
      console.warn("Utente non autenticato - impossibile eliminare la cronologia");
      return false;
    }

    // Invia la richiesta DELETE al server per eliminare la cronologia
    const response = await fetch("https://taskly-production.up.railway.app/chat/history/clear", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Errore nell'eliminazione cronologia chat: HTTP ${response.status}`);
      return false;
    }

    console.log("✅ Cronologia chat eliminata dal server");
    return true;

  } catch (error: any) {
    console.error("❌ Errore nell'eliminazione della cronologia chat:", error);
    return false;
  }
}

/**
 * Crea una nuova sessione chat sul server
 * @param {string} customChatId - Optional custom chat ID
 * @returns {Promise<string>} - Il chat_id della nuova sessione creata
 */
export async function createNewChat(customChatId?: string): Promise<string> {
  try {
    // Importa la funzione createChat dal chatHistoryService
    const { createChat } = await import('./chatHistoryService');

    // Crea la sessione chat sul server
    const chatData = await createChat(customChatId);

    console.log('✅ Nuova chat creata con ID:', chatData.chat_id);
    return chatData.chat_id;
  } catch (error) {
    console.error('❌ Errore durante la creazione della chat:', error);
    throw error;
  }
}

/**
 * Valida un messaggio prima dell'invio
 * @param {string} message - Il messaggio da validare
 * @returns {boolean} - True se il messaggio è valido
 */
export function validateMessage(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const trimmedMessage = message.trim();

  // Controllo lunghezza minima e massima
  if (trimmedMessage.length === 0 || trimmedMessage.length > 5000) {
    return false;
  }

  return true;
}

/**
 * Formatta un messaggio per la visualizzazione
 * @param {string} message - Il messaggio da formattare
 * @returns {string} - Il messaggio formattato con supporto Markdown
 */
export function formatMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return "";
  }

  let formattedMessage = message.trim();

  // Converte alcuni pattern comuni in Markdown
  // Titoli con emoji task
  formattedMessage = formattedMessage.replace(
    /📅 TASK PER LA DATA (.+?):/g,
    '## 📅 Task per la data $1\n\n'
  );

  // Totale task trovati
  formattedMessage = formattedMessage.replace(
    /📊 Totale task trovati: (\d+)/g,
    '\n---\n**📊 Totale task trovati:** `$1`'
  );

  // Pattern per evidenziare i numeri di task
  formattedMessage = formattedMessage.replace(
    /(\d+) task/g,
    '**$1** task'
  );

  // Pattern per evidenziare le date
  formattedMessage = formattedMessage.replace(
    /(\d{4}-\d{2}-\d{2})/g,
    '`$1`'
  );

  // Pattern per evidenziare gli orari
  formattedMessage = formattedMessage.replace(
    /(\d{2}:\d{2})/g,
    '`$1`'
  );

  // Converti status in badge
  formattedMessage = formattedMessage.replace(
    /"status":\s*"([^"]+)"/g,
    '"status": **$1**'
  );

  // Converti category_name in evidenziato
  formattedMessage = formattedMessage.replace(
    /"category_name":\s*"([^"]+)"/g,
    '"category_name": *$1*'
  );

  return formattedMessage;
}

/**
 * Determina se una risposta del bot contiene dati strutturati (JSON)
 * @param {string} response - La risposta del bot
 * @returns {boolean} - True se la risposta contiene dati strutturati
 */
export function isStructuredResponse(response: string): boolean {
  if (!response || typeof response !== 'string') {
    return false;
  }

  try {
    const parsed = JSON.parse(response);
    return parsed && typeof parsed === 'object' && parsed.mode === 'view';
  } catch {
    return false;
  }
}

/**
 * Estrae i dati strutturati da una risposta del bot
 * @param {string} response - La risposta del bot in formato JSON
 * @returns {any} - I dati strutturati estratti o null se non validi
 */
export function extractStructuredData(response: string): any {
  try {
    return JSON.parse(response);
  } catch {
    return null;
  }
}
