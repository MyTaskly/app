import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceBotWebSocket, VoiceChatCallbacks, VoiceServerPhase } from '../services/voiceBotService';
import { AudioRecorder, AudioPlayer, checkAudioPermissions, base64ToArrayBuffer } from '../utils/audioUtils';

/**
 * Stati possibili della chat vocale
 */
export type VoiceChatState =
  | 'idle'            // Inattivo
  | 'connecting'      // Connessione WebSocket in corso
  | 'authenticating'  // Autenticazione in corso
  | 'setting_up'      // Server sta configurando MCP + RealtimeAgent
  | 'ready'           // Pronto per ricevere input
  | 'recording'       // Registrazione audio utente
  | 'processing'      // Agent sta elaborando
  | 'speaking'        // Riproduzione risposta audio
  | 'error'           // Stato di errore
  | 'disconnected';   // Disconnesso

/**
 * Informazioni sullo stato del server
 */
export interface ServerStatus {
  phase: string;
  message: string;
}

/**
 * Trascrizione di un messaggio vocale
 */
export interface VoiceTranscript {
  role: 'user' | 'assistant';
  content: string;
  item_id?: string;
}

/**
 * Tool in esecuzione
 */
export interface ActiveTool {
  name: string;
  args: string;
  status: 'running' | 'complete';
  output?: string;
}

/**
 * Hook personalizzato per la gestione della chat vocale
 * Compatibile con l'OpenAI Realtime API tramite WebSocket
 * Usa @picovoice/react-native-voice-processor per streaming PCM16 base64 in tempo reale a 24kHz
 */
export function useVoiceChat() {
  // Stati principali
  const [state, setState] = useState<VoiceChatState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [chunksReceived, setChunksReceived] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Trascrizioni e tool
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);

  // Refs per gestire le istanze
  const websocketRef = useRef<VoiceBotWebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldAutoStartRecordingRef = useRef<boolean>(false);
  const agentEndedRef = useRef<boolean>(true);
  const isMutedRef = useRef<boolean>(false);
  const isStartingRecordingRef = useRef<boolean>(false); // Previene avvii concorrenti di registrazione
  const isMountedRef = useRef<boolean>(true); // Guard per evitare setState dopo unmount

  /**
   * Verifica e richiede i permessi audio
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await checkAudioPermissions();
      setHasPermissions(granted);

      if (!granted) {
        setError('Permessi microfono richiesti per la chat vocale');
        setState('error');
      }

      return granted;
    } catch (err) {
      console.error('Errore richiesta permessi:', err);
      setError('Errore nella richiesta dei permessi');
      setState('error');
      return false;
    }
  }, []);

  /**
   * Ref stabile per le callback WebSocket.
   * Viene aggiornato ad ogni render in modo che VoiceBotWebSocket usi sempre
   * le callback correnti, anche dopo chiusura e riapertura del modal.
   * Questo risolve il problema "schermata statica ai numeri pari" causato da
   * closure stale catturate in initialize() al primo render.
   */
  const websocketCallbacksRef = useRef<VoiceChatCallbacks>({});

  // Proxy stabile passato al costruttore VoiceBotWebSocket: delega sempre al ref corrente
  const stableCallbacks = useRef<VoiceChatCallbacks>({
    onConnectionOpen:       (...args) => websocketCallbacksRef.current.onConnectionOpen?.(...args),
    onAuthenticationSuccess:(...args) => websocketCallbacksRef.current.onAuthenticationSuccess?.(...args),
    onReady:                (...args) => websocketCallbacksRef.current.onReady?.(...args),
    onAuthenticationFailed: (...args) => websocketCallbacksRef.current.onAuthenticationFailed?.(...args),
    onConnectionClose:      (...args) => websocketCallbacksRef.current.onConnectionClose?.(...args),
    onStatus:               (...args) => websocketCallbacksRef.current.onStatus?.(...args),
    onAudioChunk:           (...args) => websocketCallbacksRef.current.onAudioChunk?.(...args),
    onTranscript:           (role, content, itemId) => websocketCallbacksRef.current.onTranscript?.(role, content, itemId),
    onToolCall:             (...args) => websocketCallbacksRef.current.onToolCall?.(...args),
    onToolOutput:           (...args) => websocketCallbacksRef.current.onToolOutput?.(...args),
    onDone:                 (...args) => websocketCallbacksRef.current.onDone?.(...args),
    onError:                (...args) => websocketCallbacksRef.current.onError?.(...args),
  }).current;

  // Aggiorna il ref ad ogni render con le callback che chiudono su stato/ref correnti
  websocketCallbacksRef.current = {
    onConnectionOpen: () => {
      if (!isMountedRef.current) return;
      setState('authenticating');
      setError(null);
    },

    onAuthenticationSuccess: (message: string) => {
      if (!isMountedRef.current) return;
      console.log('Autenticazione completata:', message);
      setState('setting_up');
    },

    onReady: () => {
      if (!isMountedRef.current) return;
      setState('ready');

      // Pre-riscalda TrackPlayer ora che il server è pronto e l'audio sta per arrivare.
      // Garantisce latenza zero al primo chunk anche in caso di init ritardata.
      audioPlayerRef.current?.preSetup();

      // Avvia la registrazione automaticamente se richiesto e non mutato
      if (shouldAutoStartRecordingRef.current && !isMutedRef.current) {
        shouldAutoStartRecordingRef.current = false;
        setTimeout(() => {
          startRecording();
        }, 150);
      } else if (isMutedRef.current) {
        shouldAutoStartRecordingRef.current = false;
      }
    },

    onAuthenticationFailed: (errorMsg: string) => {
      if (!isMountedRef.current) return;
      console.error('Autenticazione fallita:', errorMsg);
      setError(`Autenticazione fallita: ${errorMsg}`);
      setState('error');
    },

    onConnectionClose: () => {
      if (!isMountedRef.current) return;
      setState('disconnected');
      shouldAutoStartRecordingRef.current = false;

      // Ferma la registrazione se attiva per evitare invio audio su connessione morta
      if (audioRecorderRef.current?.isCurrentlyRecording()) {
        audioRecorderRef.current.cancelRecording().catch(err => {
          console.error('Errore fermando registrazione su disconnessione:', err);
        });
      }

      // Pulisci il timer della durata
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    },

    onStatus: async (phase: VoiceServerPhase, message: string) => {
      if (!isMountedRef.current) return;
      setServerStatus({ phase, message });

      switch (phase) {
        case 'speech_started':
          // VAD OpenAI: utente sta parlando
          setState('recording');
          break;

        case 'speech_stopped':
          // VAD OpenAI: utente ha smesso di parlare — il mic resta acceso,
          // OpenAI processa il turno e risponde in autonomia
          setState('processing');
          break;

        case 'agent_start':
          setState('processing');
          agentEndedRef.current = false;
          break;

        case 'agent_end':
          agentEndedRef.current = true;
          // Se non ci sono chunk audio pendenti, torna subito a ready
          if (!audioPlayerRef.current?.hasPendingOrQueuedChunks() &&
              !audioPlayerRef.current?.isCurrentlyPlaying()) {
            console.log('[useVoiceChat] Fine risposta chatbot');
            setState('ready');
          }
          break;

        case 'audio_end':
          if (audioPlayerRef.current?.hasPendingOrQueuedChunks()) {
            setState('speaking');
            audioPlayerRef.current.signalAllChunksReceived(() => {
              if (agentEndedRef.current) {
                console.log('[useVoiceChat] Fine risposta chatbot');
                setState('ready');
              } else {
                setState('processing');
              }
            });
          } else if (agentEndedRef.current) {
            console.log('[useVoiceChat] Fine risposta chatbot');
            setState('ready');
          }
          break;

        case 'interrupted':
          agentEndedRef.current = true;
          // Ferma solo la riproduzione audio, il mic resta acceso
          if (audioPlayerRef.current) {
            await audioPlayerRef.current.stopPlayback();
          }
          setState('ready');
          break;
      }
    },

    onAudioChunk: (audioData: string, chunkIndex: number) => {
      if (!isMountedRef.current) return;
      if (audioPlayerRef.current) {
        audioPlayerRef.current.addChunk(audioData, chunkIndex).catch(err => {
          console.error('[useVoiceChat] Errore aggiunta chunk a TrackPlayer:', err);
        });
        setChunksReceived(prev => prev + 1);
        setState(prev => prev !== 'speaking' ? 'speaking' : prev);
      }
    },

    onTranscript: (role: 'user' | 'assistant', content: string, itemId?: string) => {
      if (!isMountedRef.current) return;
      setTranscripts(prev => {
        if (itemId) {
          const idx = prev.findLastIndex(t => t.item_id === itemId);
          if (idx !== -1) {
            // Aggiorna il transcript esistente con il testo più completo
            const updated = [...prev];
            updated[idx] = { role, content, item_id: itemId };
            return updated;
          }
        }
        return [...prev, { role, content, item_id: itemId }];
      });
    },

    onToolCall: (toolName: string, args: string) => {
      if (!isMountedRef.current) return;
      console.log(`[useVoiceChat] Tool chiamato: ${toolName}`, args);
      setActiveTools(prev => [...prev, { name: toolName, args, status: 'running' }]);
    },

    onToolOutput: (toolName: string, output: string) => {
      if (!isMountedRef.current) return;
      console.log(`[useVoiceChat] Tool completato: ${toolName}`);
      setActiveTools(prev => prev.map(t =>
        t.name === toolName && t.status === 'running'
          ? { ...t, status: 'complete' as const, output }
          : t
      ));
    },

    onDone: () => {
      if (!isMountedRef.current) return;
      setState('disconnected');
    },

    onError: (errorMessage: string) => {
      if (!isMountedRef.current) return;
      setError(errorMessage);
      setState('error');
    }
  };

  /**
   * Inizializza le istanze audio e WebSocket
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      const permissionsGranted = await requestPermissions();
      if (!permissionsGranted) return false;

      audioRecorderRef.current = new AudioRecorder();
      audioPlayerRef.current = new AudioPlayer();
      websocketRef.current = new VoiceBotWebSocket(stableCallbacks);

      // Pre-inizializza TrackPlayer per evitare ritardi al primo chunk audio.
      // Questo elimina la race condition dove audio_end/agent_end arrivano
      // prima che TrackPlayer abbia finito il setup.
      await audioPlayerRef.current.preSetup();

      return true;
    } catch (err) {
      console.error('Errore inizializzazione:', err);
      setError('Errore durante l\'inizializzazione');
      setState('error');
      return false;
    }
  }, [requestPermissions]);

  /**
   * Connette al servizio vocale
   */
  const connect = useCallback(async (): Promise<boolean> => {
    if (!websocketRef.current) {
      const initialized = await initialize();
      if (!initialized) return false;
    }

    setState('connecting');
    setError(null);
    setTranscripts([]);
    setActiveTools([]);
    setChunksReceived(0);
    shouldAutoStartRecordingRef.current = true;
    agentEndedRef.current = true;

    try {
      const connected = await websocketRef.current!.connect();
      if (!connected) {
        setError('Impossibile connettersi al servizio vocale');
        setState('error');
        shouldAutoStartRecordingRef.current = false;
        return false;
      }
      // Le transizioni di stato avvengono via callback:
      // connecting -> authenticating -> setting_up -> ready
      return true;
    } catch (err) {
      setError('Errore di connessione');
      setState('error');
      shouldAutoStartRecordingRef.current = false;
      return false;
    }
  }, [initialize]);

  /**
   * Avvia la registrazione audio con streaming chunks via WebSocket.
   * Ogni frame PCM16 a 24kHz viene inviato in tempo reale come binary frame.
   *
   * IMPORTANTE: Il microfono invia audio continuamente. OpenAI gestisce
   * automaticamente VAD e interruzioni. Non serve commit o interrupt manuale.
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!audioRecorderRef.current || !websocketRef.current) {
      setError('Servizio non inizializzato');
      return false;
    }

    if (!websocketRef.current.isReady()) {
      setError('Sessione vocale non pronta');
      return false;
    }

    // Previeni avvii concorrenti (es. doppio onComplete)
    if (isStartingRecordingRef.current || audioRecorderRef.current.isCurrentlyRecording()) {
      return false;
    }

    isStartingRecordingRef.current = true;

    try {
      // Callback invocato per ogni chunk audio PCM16 a 24kHz.
      // Il mic rimane sempre acceso: è il VAD server-side di OpenAI
      // a gestire i turni e le interruzioni automaticamente.
      const onChunk = (base64Chunk: string) => {
        try {
          const arrayBuffer = base64ToArrayBuffer(base64Chunk);
          websocketRef.current?.sendAudio(arrayBuffer);
        } catch (error) {
          console.error('Errore conversione chunk audio:', error);
        }
      };

      const started = await audioRecorderRef.current.startRecording(onChunk);
      if (!started) {
        setError('Impossibile avviare la registrazione');
        isStartingRecordingRef.current = false;
        return false;
      }

      setState('recording');
      setError(null);
      isStartingRecordingRef.current = false;

      // Aggiorna la durata della registrazione ogni 100ms
      recordingIntervalRef.current = setInterval(() => {
        if (audioRecorderRef.current) {
          setRecordingDuration(audioRecorderRef.current.getRecordingDuration());
        }
      }, 100);

      return true;
    } catch (err) {
      console.error('Errore avvio registrazione:', err);
      setError('Errore durante la registrazione');
      setState('error');
      isStartingRecordingRef.current = false;
      return false;
    }
  }, []);

  /**
   * Ferma la registrazione.
   * I chunks sono già stati inviati in streaming durante la registrazione.
   * Il VAD di OpenAI rileva automaticamente la fine della frase, non serve commit manuale.
   */
  const stopRecording = useCallback(async (): Promise<boolean> => {
    if (!audioRecorderRef.current || !websocketRef.current) return false;

    // Ferma il timer della durata
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      await audioRecorderRef.current.stopRecording();

      setState('processing');
      setRecordingDuration(0);
      return true;

    } catch (err) {
      console.error('Errore stop registrazione:', err);
      setError('Errore durante l\'arresto della registrazione');
      setState('error');
      return false;
    }
  }, []);

  /**
   * Cancella la registrazione corrente
   */
  const cancelRecording = useCallback(async (): Promise<void> => {
    if (audioRecorderRef.current) {
      await audioRecorderRef.current.cancelRecording();
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    setRecordingDuration(0);
    setState('ready');
  }, []);

  /**
   * Ferma la riproduzione audio corrente
   */
  const stopPlayback = useCallback(async (): Promise<void> => {
    if (audioPlayerRef.current) {
      await audioPlayerRef.current.stopPlayback();
      audioPlayerRef.current.clearChunks();
    }

    setState('ready');
  }, []);

  /**
   * Invia un messaggio di testo all'assistente
   */
  const sendTextMessage = useCallback((content: string): void => {
    if (websocketRef.current?.isReady()) {
      websocketRef.current.sendText(content);
      setState('processing');
    }
  }, []);

  /**
   * Muta il microfono (azione manuale dell'utente)
   */
  const mute = useCallback(async (): Promise<void> => {
    setIsMuted(true);
    isMutedRef.current = true;

    if (audioRecorderRef.current?.isCurrentlyRecording()) {
      try {
        await audioRecorderRef.current.cancelRecording();
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        setRecordingDuration(0);
        if (state === 'recording') setState('ready');
      } catch (err) {
        console.error('Errore durante il mute:', err);
      }
    }
  }, [state]);

  /**
   * Riattiva il microfono (azione manuale dell'utente)
   */
  const unmute = useCallback(async (): Promise<void> => {
    setIsMuted(false);
    isMutedRef.current = false;

    if (websocketRef.current?.isReady()) {
      setTimeout(() => startRecording(), 100);
    }
  }, [startRecording]);

  /**
   * Disconnette dal servizio
   */
  const disconnect = useCallback(async (): Promise<void> => {
    // Prima ferma la registrazione per evitare invio audio su connessione che sta chiudendo
    if (audioRecorderRef.current?.isCurrentlyRecording()) {
      try {
        await audioRecorderRef.current.cancelRecording();
      } catch (err) {
        console.error('Errore fermando registrazione durante disconnect:', err);
      }
    }

    // Pulisci il timer della durata
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Ferma l'audio player
    if (audioPlayerRef.current?.isCurrentlyPlaying()) {
      try {
        await audioPlayerRef.current.stopPlayback();
      } catch (err) {
        console.error('Errore fermando playback durante disconnect:', err);
      }
    }

    // Poi chiudi il WebSocket e resetta il ref così al prossimo connect()
    // viene sempre creata una nuova istanza con callback aggiornate
    if (websocketRef.current) {
      websocketRef.current.disconnect();
      websocketRef.current = null;
    }

    setState('idle');
    setServerStatus(null);
    setError(null);
    setTranscripts([]);
    setActiveTools([]);
    setRecordingDuration(0);
    setIsMuted(false);
    isMutedRef.current = false;
    isStartingRecordingRef.current = false;
    shouldAutoStartRecordingRef.current = false;
    agentEndedRef.current = true;
  }, []);

  /**
   * Pulisce tutte le risorse
   */
  const cleanup = useCallback(async (): Promise<void> => {
    // Pulisci il timer della durata
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Prima ferma la registrazione
    if (audioRecorderRef.current) {
      try {
        await audioRecorderRef.current.cancelRecording();
      } catch (err) {
        console.error('Errore cleanup registrazione:', err);
      }
      audioRecorderRef.current = null;
    }

    // Poi ferma il player
    if (audioPlayerRef.current) {
      try {
        await audioPlayerRef.current.destroy();
      } catch (err) {
        console.error('Errore cleanup player:', err);
      }
      audioPlayerRef.current = null;
    }

    // Infine chiudi il WebSocket
    if (websocketRef.current) {
      try {
        websocketRef.current.destroy();
      } catch (err) {
        console.error('Errore cleanup websocket:', err);
      }
      websocketRef.current = null;
    }

    setState('idle');
    setError(null);
    setServerStatus(null);
    setRecordingDuration(0);
    setTranscripts([]);
    setActiveTools([]);
  }, []);

  // Cleanup automatico quando il componente viene smontato
  const cleanupRef = useRef(cleanup);
  useEffect(() => {
    cleanupRef.current = cleanup;
  });
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupRef.current();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stati derivati
  const isConnected = ['ready', 'recording', 'processing', 'speaking'].includes(state);
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const isSpeaking = state === 'speaking';
  const canRecord = state === 'ready' && hasPermissions;
  const canStop = state === 'recording';

  return {
    // Stati
    state,
    error,
    serverStatus,
    recordingDuration,
    hasPermissions,
    chunksReceived,
    isMuted,

    // Trascrizioni e tool
    transcripts,
    activeTools,

    // Stati derivati
    isConnected,
    isRecording,
    isProcessing,
    isSpeaking,
    canRecord,
    canStop,

    // Azioni
    initialize,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    cancelRecording,
    stopPlayback,
    sendTextMessage,
    cleanup,
    requestPermissions,
    mute,
    unmute,
  };
}
