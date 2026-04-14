import { TaskCacheService, OfflineChange } from './TaskCacheService';
import StorageManager from './StorageManager';
import NetworkService, { NetworkState } from './NetworkService';
import { emitTasksSynced } from '../utils/eventEmitter';
import {
  trackOfflineOperation,
  trackOfflineSyncCompleted,
} from './analyticsService';

// Lazy import per evitare require cycle con taskService
async function getTaskServiceFunctions() {
  const taskService = await import('./taskService');
  return {
    getTasksFromAPI: taskService.getAllTasks,
    getCategoriesFromAPI: taskService.getCategories,
    addTaskToAPI: taskService.addTask,
    updateTaskToAPI: taskService.updateTask,
    deleteTaskFromAPI: taskService.deleteTask,
  };
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  errors: string[];
}

export interface SyncOperation {
  id: string;
  type: 'GET_TASKS' | 'GET_CATEGORIES' | 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK';
  data?: any;
  retries: number;
  timestamp: number;
}

class SyncManager {
  private static instance: SyncManager;
  private cacheService: TaskCacheService | null = null;
  private storageManager: StorageManager | null = null;
  private networkService: NetworkService | null = null;
  private syncQueue: SyncOperation[] = [];
  private isSyncing = false;
  private isOnline = false;
  private retryDelays = [1000, 5000, 15000, 60000]; // Exponential backoff
  private syncListeners: ((status: SyncStatus) => void)[] = [];
  private networkListener: (() => void) | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private initialized = false;
  private lastSyncDataFromServer: number = 0; // Timestamp ultimo sync per throttling
  private syncDataThrottleMs: number = 5000; // Minimo 5 secondi tra sync dal server

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.cacheService = TaskCacheService.getInstance();
      this.storageManager = StorageManager.getInstance();
      this.networkService = NetworkService.getInstance();
      this.initializeNetworkListener();
      this.initialized = true;
    }
  }

  // Inizializza il listener per lo stato della rete
  private async initializeNetworkListener(): Promise<void> {
    try {
      // Controlla stato iniziale
      const networkState = await this.networkService!.getNetworkState();
      this.isOnline = networkState.isConnected;

      // Listener per cambiamenti di stato rete
      this.networkListener = this.networkService!.addNetworkListener((state: NetworkState) => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected;

        console.log('[SYNC] Stato rete cambiato:', wasOnline ? 'online' : 'offline', '->', this.isOnline ? 'online' : 'offline');

        // Se siamo tornati online, avvia la sincronizzazione
        if (!wasOnline && this.isOnline) {
          console.log('[SYNC] Rete ripristinata, avvio sync automatico');
          setTimeout(() => this.startSync(), 1000); // Delay per stabilizzare la connessione
        }

        this.notifyListeners();
      });

      // Avvia sync periodico se online
      if (this.isOnline) {
        this.startPeriodicSync();
      }
    } catch (error) {
      console.error('[SYNC] Errore nell\'inizializzazione network listener:', error);
    }
  }

  // Avvia sincronizzazione periodica intelligente
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync ogni 5 minuti quando l'app è attiva
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        const cacheStats = await this.cacheService!.getCacheStats();
        
        // Sync solo se ci sono modifiche offline o cache obsoleta
        if (cacheStats.offlineChanges > 0 || await this.cacheService!.isCacheStale()) {
          console.log('[SYNC] Sync periodico avviato');
          await this.startSync();
        }
      }
    }, 5 * 60 * 1000); // 5 minuti
  }

  // Avvia il processo di sincronizzazione
  async startSync(force: boolean = false): Promise<void> {
    this.ensureInitialized();
    
    if (this.isSyncing && !force) {
      console.log('[SYNC] Sincronizzazione già in corso');
      return;
    }

    if (!this.isOnline) {
      console.log('[SYNC] Offline - sincronizzazione rimandata');
      return;
    }

    try {
      this.isSyncing = true;
      this.notifyListeners();
      
      console.log('[SYNC] Inizio sincronizzazione...');

      // 1. Prima sincronizza le modifiche offline
      await this.syncOfflineChanges();

      // 2. Poi aggiorna i dati dal server
      await this.syncDataFromServer();

      console.log('[SYNC] Sincronizzazione completata con successo');
    } catch (error) {
      console.error('[SYNC] Errore nella sincronizzazione:', error);
      this.addSyncOperation('GET_TASKS', {}); // Riprova più tardi
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  // Sincronizza le modifiche offline con il server
  private async syncOfflineChanges(): Promise<void> {
    const offlineChanges = await this.cacheService!.getOfflineChanges();
    
    if (offlineChanges.length === 0) {
      return;
    }

    console.log(`[SYNC] Sincronizzazione di ${offlineChanges.length} modifiche offline`);

    const successfulChanges: string[] = [];

    for (const change of offlineChanges) {
      try {
        await this.processOfflineChange(change);
        successfulChanges.push(change.id);
      } catch (error) {
        console.error(`[SYNC] Errore nella sincronizzazione modifica ${change.id}:`, error);
        // Le modifiche fallite rimangono nella coda per retry successivi
      }
    }

    // Rimuovi solo le modifiche sincronizzate con successo
    if (successfulChanges.length > 0) {
      const remainingChanges = offlineChanges.filter(
        change => !successfulChanges.includes(change.id)
      );
      
      // Aggiorna la coda delle modifiche offline
      await this.cacheService!.clearOfflineChanges();
      for (const change of remainingChanges) {
        await this.cacheService!.saveOfflineChange(change);
      }

      console.log(`[SYNC] Sincronizzate ${successfulChanges.length} modifiche, ${remainingChanges.length} rimanenti`);
      
      // ── Analytics: traccia sync offline completato ──
      trackOfflineSyncCompleted(successfulChanges.length);
    }
  }

  // Processa una singola modifica offline
  private async processOfflineChange(change: OfflineChange): Promise<void> {
    switch (change.type) {
      case 'CREATE':
        if (change.entityType === 'TASK') {
          const { addTaskToAPI } = await getTaskServiceFunctions();
          await addTaskToAPI(change.data);
        }
        break;

      case 'UPDATE':
        if (change.entityType === 'TASK') {
          const { updateTaskToAPI } = await getTaskServiceFunctions();
          await updateTaskToAPI(change.data.id || change.data.task_id, change.data);
        }
        break;

      case 'DELETE':
        if (change.entityType === 'TASK') {
          const { deleteTaskFromAPI } = await getTaskServiceFunctions();
          await deleteTaskFromAPI(change.data.id || change.data.task_id);
        }
        break;

      default:
        throw new Error(`Tipo di modifica non supportato: ${change.type}`);
    }
  }

  // Sincronizza i dati dal server (con throttling)
  private async syncDataFromServer(): Promise<void> {
    // Throttling: evita sync troppo frequenti
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncDataFromServer;
    if (timeSinceLastSync < this.syncDataThrottleMs) {
      console.log(`[SYNC] ⏳ Throttling: sync saltato (ultimo sync ${timeSinceLastSync}ms fa, minimo ${this.syncDataThrottleMs}ms)`);
      return;
    }
    this.lastSyncDataFromServer = now;

    try {
      console.log('[SYNC] 🔄 Aggiornamento dati dal server...');

      // Carica tasks e categorie dal server
      const { getTasksFromAPI, getCategoriesFromAPI } = await getTaskServiceFunctions();
      const [serverTasks, categories] = await Promise.all([
        getTasksFromAPI(),
        getCategoriesFromAPI()
      ]);

      console.log(`[SYNC] 📡 Ricevuti dal server: ${(serverTasks || []).length} task, ${(categories || []).length} categorie`);

      // Merge con la cache esistente per preservare i campi di ricorrenza che il server
      // potrebbe non includere nel list endpoint (is_recurring, recurrence_pattern, ecc.)
      const existingTasks = await this.cacheService!.getCachedTasks();
      const existingById = new Map(
        existingTasks.map(t => [String(t.task_id || t.id), t])
      );

      const mergedTasks = (serverTasks || []).map((serverTask: any) => {
        const taskId = String(serverTask.task_id || serverTask.id);
        const existing = existingById.get(taskId);
        if (!existing) return serverTask;

        return {
          ...serverTask,
          // Preserva i campi ricorrenza se il server non li restituisce (undefined/null)
          is_recurring: serverTask.is_recurring ?? existing.is_recurring,
          recurrence_pattern: serverTask.recurrence_pattern ?? existing.recurrence_pattern,
          recurrence_interval: serverTask.recurrence_interval ?? existing.recurrence_interval,
          recurrence_end_type: serverTask.recurrence_end_type ?? existing.recurrence_end_type,
          recurrence_days_of_week: serverTask.recurrence_days_of_week ?? existing.recurrence_days_of_week,
          recurrence_day_of_month: serverTask.recurrence_day_of_month ?? existing.recurrence_day_of_month,
          recurrence_end_date: serverTask.recurrence_end_date ?? existing.recurrence_end_date,
          recurrence_end_count: serverTask.recurrence_end_count ?? existing.recurrence_end_count,
        };
      });

      // Salva nella cache (questo triggerà anche la rimozione dei task fantasma)
      await this.cacheService!.saveTasks(mergedTasks, categories || []);

      console.log(`[SYNC] ✅ Sincronizzazione completata: ${mergedTasks.length} task e ${(categories || []).length} categorie`);

      // Emetti evento di sincronizzazione completata
      console.log('[SYNC] 📢 Emitting TASKS_SYNCED event');
      emitTasksSynced(mergedTasks, categories || []);
    } catch (error) {
      console.error('[SYNC] ❌ Errore nell\'aggiornamento dati dal server:', error);
      throw error;
    }
  }

  // Aggiungi un'operazione alla coda di sincronizzazione
  addSyncOperation(type: SyncOperation['type'], data: any = {}): void {
    // Deduplicazione: evita operazioni GET_TASKS duplicate nella coda
    if (type === 'GET_TASKS') {
      const existingGetTasks = this.syncQueue.find(op => op.type === 'GET_TASKS');
      if (existingGetTasks) {
        console.log('[SYNC] ⏭️ GET_TASKS già in coda, skip duplicato');
        return;
      }
    }

    const operation: SyncOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      retries: 0,
      timestamp: Date.now()
    };

    this.syncQueue.push(operation);
    console.log(`[SYNC] Operazione aggiunta alla coda: ${type}`);

    // Avvia sync se online
    if (this.isOnline && !this.isSyncing) {
      setTimeout(() => this.processSyncQueue(), 100);
    }
  }

  // Processa la coda di sincronizzazione
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0 || !this.isOnline) {
      return;
    }

    const operation = this.syncQueue.shift();
    if (!operation) return;

    try {
      await this.processOperation(operation);
    } catch (error) {
      console.error(`[SYNC] Errore nell'operazione ${operation.type}:`, error);
      
      // Retry con exponential backoff
      if (operation.retries < this.retryDelays.length) {
        const delay = this.retryDelays[operation.retries];
        operation.retries++;
        
        setTimeout(() => {
          this.syncQueue.unshift(operation); // Rimetti in testa alla coda
          this.processSyncQueue();
        }, delay);
        
        console.log(`[SYNC] Retry operazione ${operation.type} in ${delay}ms (tentativo ${operation.retries})`);
      } else {
        console.error(`[SYNC] Operazione ${operation.type} fallita dopo ${operation.retries} tentativi`);
      }
    }

    // Continua con la prossima operazione
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processSyncQueue(), 100);
    }
  }

  // Processa una singola operazione
  private async processOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'GET_TASKS':
        await this.syncDataFromServer();
        break;
        
      case 'CREATE_TASK': {
        const { addTaskToAPI } = await getTaskServiceFunctions();
        await addTaskToAPI(operation.data);
        break;
      }
        
      case 'UPDATE_TASK': {
        const { updateTaskToAPI } = await getTaskServiceFunctions();
        await updateTaskToAPI(operation.data.id, operation.data.task);
        break;
      }
        
      case 'DELETE_TASK': {
        const { deleteTaskFromAPI } = await getTaskServiceFunctions();
        await deleteTaskFromAPI(operation.data.id);
        break;
      }
        
      default:
        throw new Error(`Operazione non supportata: ${operation.type}`);
    }
  }

  // Salva una modifica offline
  async saveOfflineChange(type: OfflineChange['type'], entityType: OfflineChange['entityType'], data: any): Promise<void> {
    this.ensureInitialized();
    
    const change: OfflineChange = {
      id: `${type}_${entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      entityType,
      data,
      timestamp: Date.now()
    };

    await this.cacheService!.saveOfflineChange(change);
    console.log(`[SYNC] Modifica offline salvata: ${type} ${entityType}`);
    
    // ── Analytics: traccia operazione offline ──
    trackOfflineOperation(type as 'CREATE' | 'UPDATE' | 'DELETE');
    
    this.notifyListeners();
  }

  // Ottieni lo stato di sincronizzazione
  async getSyncStatus(): Promise<SyncStatus> {
    this.ensureInitialized();
    
    const cacheStats = await this.cacheService!.getCacheStats();
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSync: cacheStats.lastSync,
      pendingChanges: cacheStats.offlineChanges,
      errors: [] // TODO: implementare tracking errori
    };
  }

  // Aggiungi listener per cambiamenti di stato
  addSyncListener(listener: (status: SyncStatus) => void): void {
    this.syncListeners.push(listener);
  }

  // Rimuovi listener
  removeSyncListener(listener: (status: SyncStatus) => void): void {
    const index = this.syncListeners.indexOf(listener);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }

  // Notifica tutti i listener
  private async notifyListeners(): Promise<void> {
    const status = await this.getSyncStatus();
    this.syncListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[SYNC] Errore nel listener:', error);
      }
    });
  }

  // Pulizia risorse
  cleanup(): void {
    if (this.networkListener) {
      this.networkListener(); // È già una funzione di cleanup
      this.networkListener = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.networkService?.cleanup();
    this.syncListeners = [];
    this.syncQueue = [];
  }

  // Forza sincronizzazione completa (per debug/reset)
  async forceFullSync(): Promise<void> {
    console.log('[SYNC] Avvio sincronizzazione forzata completa');
    
    // Pulisci cache
    this.ensureInitialized();
    await this.cacheService!.clearCache();
    
    // Avvia sync
    await this.startSync(true);
  }

  // Verifica conflitti (placeholder per implementazione futura)
  async checkForConflicts(): Promise<boolean> {
    // TODO: Implementare logica per rilevare conflitti
    // Confrontare timestamp server vs locale
    return false;
  }
}

export default SyncManager;