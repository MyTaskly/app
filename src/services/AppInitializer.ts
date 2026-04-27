import { TaskCacheService } from './TaskCacheService';
import SyncManager from './SyncManager';
import StorageManager from './StorageManager';
import { getAllTasks, getCategories } from './taskService';
import { initializeGoogleSignIn } from './googleSignInService';
import { checkAndRefreshAuth } from './authService';
import { registerForPushNotificationsAsync, sendTokenToBackend } from './notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/authConstants';

class AppInitializer {
  private static instance: AppInitializer;
  private initialized = false;
  
  static getInstance(): AppInitializer {
    if (!AppInitializer.instance) {
      AppInitializer.instance = new AppInitializer();
    }
    return AppInitializer.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[APP_INIT] App già inizializzata');
      return;
    }

    try {
      console.log('[APP_INIT] Inizio inizializzazione app...');
      
      // 0. Inizializza Google Sign-In
      await this.initializeGoogleAuth();

      // 1. Controlla e carica dati utente
      await this.loadUserData();

      // 2. Inizializza i servizi
      const cacheService = TaskCacheService.getInstance();
      const syncManager = SyncManager.getInstance();
      const storageManager = StorageManager.getInstance();

      // 3. Controlla e pulisci storage se necessario
      const storageInfo = await storageManager.checkStorageLimit();
      if (storageInfo.isNearLimit) {
        console.log('[APP_INIT] Spazio storage limitato, pulizia automatica...');
        await storageManager.cleanupOldData();
      }

      // 4. Verifica autenticazione prima di inizializzare cache e sync
      const authStatus = await checkAndRefreshAuth();

      if (!authStatus.isAuthenticated) {
        console.log('[APP_INIT] Utente non autenticato, skip operazioni cache e sync');
        // Carica eventuali dati dalla cache locale per funzionalità offline
        const hasCachedData = await cacheService.hasCachedData();
        if (hasCachedData) {
          console.log('[APP_INIT] Dati cache disponibili per modalità offline');
          this.isDataLoaded = true;
        } else {
          console.log('[APP_INIT] Nessun dato cache, app in modalità vuota');
          this.notifyDataLoaded([], []);
        }
      } else {
        console.log('[APP_INIT] Utente autenticato, procedo con inizializzazione cache');

        // Controlla se abbiamo dati in cache
        const hasCachedData = await cacheService.hasCachedData();

        if (!hasCachedData) {
          // Avvia caricamento sincrono senza aspettare per non bloccare l'inizializzazione
          this.dataLoadPromise = this.loadDataSynchronously();
          this.dataLoadPromise.catch(error =>
            console.error('[APP_INIT] Errore caricamento dati:', error)
          );
        } else {
          // I dati sono già disponibili dalla cache
          this.isDataLoaded = true;

          // Verifica se la cache è obsoleta
          const isCacheStale = await cacheService.isCacheStale();
          if (isCacheStale) {
            // Avvia sync sincrono per aggiornare i dati
            this.dataLoadPromise = this.loadDataSynchronously();
            this.dataLoadPromise.catch(error =>
              console.error('[APP_INIT] Errore aggiornamento dati:', error)
            );
          }
        }

        // 5. Controlla modifiche offline da sincronizzare (solo se autenticato)
        const offlineChanges = await cacheService.getOfflineChanges();
        if (offlineChanges.length > 0) {
          console.log(`[APP_INIT] ${offlineChanges.length} modifiche offline da sincronizzare`);
          // Avvia sync per le modifiche offline
          syncManager.startSync().catch(error =>
            console.error('[APP_INIT] Errore sync offline changes:', error)
          );
        }

        // --- INIZIO: ALLINEAMENTO AUTOMATICO TOKEN NOTIFICHE PUSH ---
        try {
          console.log('[APP_INIT] Verifica integrità e sincronizzazione automatica Push Token...');
          const currentToken = await registerForPushNotificationsAsync();
          if (currentToken) {
            await sendTokenToBackend(currentToken, true);
            console.log('[APP_INIT] ✅ Sync del token notifica completato con successo durante l\'avvio.');
          }
        } catch (pushError) {
          console.error('[APP_INIT] ❌ Errore durante sync automatico token notifiche all\'avvio:', pushError);
        }
        // --- FINE: ALLINEAMENTO AUTOMATICO TOKEN NOTIFICHE PUSH ---
      }

      // 6. Inizializza pulizie periodiche
      this.setupPeriodicMaintenance();

      this.initialized = true;
      console.log('[APP_INIT] Inizializzazione completata');
      
    } catch (error) {
      console.error('[APP_INIT] Errore nell\'inizializzazione:', error);
      // Non bloccare l'app anche se l'inizializzazione fallisce
    }
  }

  private async loadUserData(): Promise<void> {
    try {
      // Controlla e aggiorna l'autenticazione
      const authStatus = await checkAndRefreshAuth();

      if (authStatus.isAuthenticated) {
        try {
          // Prova a recuperare i dati utente dal server per avere informazioni aggiornate
          const { getValidToken } = await import('./authService');
          const token = await getValidToken();

          if (token) {
            const axios = (await import('./axiosInstance')).default;
            const response = await axios.get('/auth/current_user_info', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            const serverUserInfo = response.data;
            if (serverUserInfo.username) {
              // Aggiorna USER_NAME con il valore dal server (più affidabile)
              await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, serverUserInfo.username);

              // Aggiorna anche i dati utente locali con le info dal server
              const existingUserData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
              const userDataToUpdate = existingUserData ? JSON.parse(existingUserData) : {};
              const updatedUserData = {
                ...userDataToUpdate,
                username: serverUserInfo.username,
                email: serverUserInfo.email || userDataToUpdate.email,
                registration_date: serverUserInfo.registration_date || userDataToUpdate.registration_date
              };
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUserData));
            }
          } else {
            // Fallback ai dati locali se non c'è token valido
            await this.loadUserDataFromStorage();
          }
        } catch (serverError) {
          console.warn('[APP_INIT] ⚠️ Impossibile recuperare dati dal server, uso dati locali:', serverError);
          // Fallback ai dati locali in caso di errore server
          await this.loadUserDataFromStorage();
        }
      }

    } catch (error) {
      console.error('[APP_INIT] ❌ Errore nel caricamento dati utente:', error);
      // Non bloccare l'inizializzazione per questo errore
    }
  }

  private async loadUserDataFromStorage(): Promise<void> {
    // Carica dati utente da AsyncStorage come fallback
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (userData) {
      const userDataParsed = JSON.parse(userData);

      // Assicurati che USER_NAME sia settato
      if (userDataParsed.username) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, userDataParsed.username);
      } else {
        // Se non abbiamo username nei dati utente, prova a recuperarlo direttamente
        const storedUsername = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
        if (storedUsername) {
          console.log(`[APP_INIT] ✅ USER_NAME già presente: ${storedUsername}`);
        } else {
          console.log('[APP_INIT] ⚠️ Nessun username trovato nei dati utente');
        }
      }
    } else {
      console.log('[APP_INIT] ⚠️ Nessun dato utente trovato in storage');
    }
  }

  private async initializeGoogleAuth(): Promise<void> {
    try {
      console.log('[APP_INIT] Inizializzazione Google Sign-In...');
      await initializeGoogleSignIn();
      console.log('[APP_INIT] ✅ Google Sign-In inizializzato');
    } catch (error) {
      console.error('[APP_INIT] ❌ Errore nell\'inizializzazione Google Sign-In:', error);
      // Non bloccare l'app se Google Sign-In fallisce
    }
  }

  private async loadDataSynchronously(): Promise<void> {
    try {
      console.log('[APP_INIT] Inizio caricamento sincrono dati...');

      // Verifica autenticazione prima di caricare dati
      const authStatus = await checkAndRefreshAuth();
      if (!authStatus.isAuthenticated) {
        console.log('[APP_INIT] Utente non autenticato, skip caricamento dati dal server');
        this.notifyDataLoaded([], []);
        return;
      }

      // Carica dati dal server in maniera sincrona
      const [tasks, categories] = await Promise.all([
        getAllTasks(false), // Non usare cache per caricamento iniziale
        getCategories(false)
      ]);

      // Salva nella cache immediatamente
      const cacheService = TaskCacheService.getInstance();
      await cacheService.saveTasks(tasks || [], categories || []);
      
      console.log(`[APP_INIT] Caricamento sincrono completato: ${(tasks || []).length} task e ${(categories || []).length} categorie`);
      
      // Notifica che i dati sono stati caricati
      this.notifyDataLoaded(tasks || [], categories || []);
      
    } catch (error) {
      console.error('[APP_INIT] Errore nel caricamento sincrono:', error);
      // In caso di errore, l'app continua a funzionare con dati vuoti o cached
      this.notifyDataLoaded([], []);
    }
  }

  private dataLoadPromise: Promise<void> | null = null;
  private isDataLoaded = false;

  private notifyDataLoaded(tasks: any[], categories: any[]): void {
    console.log('[APP_INIT] Dati caricati e disponibili per l\'app');
    this.isDataLoaded = true;
    // Qui potresti emettere un evento o chiamare callback se necessario
  }

  // Metodo per aspettare il caricamento dei dati se necessario
  async waitForDataLoad(timeout: number = 10000): Promise<boolean> {
    if (this.isDataLoaded) {
      return true;
    }

    if (!this.dataLoadPromise) {
      // Se non c'è un caricamento in corso, avvialo
      this.dataLoadPromise = this.loadDataSynchronously();
    }

    try {
      // Aspetta il caricamento con timeout
      await Promise.race([
        this.dataLoadPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      return this.isDataLoaded;
    } catch (error) {
      console.warn('[APP_INIT] Timeout o errore nell\'attesa dati:', error);
      return false;
    }
  }

  // Verifica se i dati sono stati caricati
  isDataReady(): boolean {
    return this.isDataLoaded;
  }

  private setupPeriodicMaintenance(): void {
    console.log('[APP_INIT] Setup manutenzione periodica');
    
    const storageManager = StorageManager.getInstance();
    
    // Pulizia storage ogni ora quando l'app è attiva
    setInterval(async () => {
      try {
        const storageInfo = await storageManager.checkStorageLimit();
        if (storageInfo.usage > 70) { // Se uso storage > 70%
          console.log('[MAINTENANCE] Avvio pulizia preventiva storage');
          await storageManager.cleanupOldData();
        }
      } catch (error) {
        console.error('[MAINTENANCE] Errore pulizia periodica:', error);
      }
    }, 60 * 60 * 1000); // 1 ora
  }

  async getInitializationStatus(): Promise<{
    initialized: boolean;
    cacheStats: {
      taskCount: number;
      categoryCount: number;
      lastSync: Date | null;
      offlineChanges: number;
      cacheSize: number;
    };
    storageStats: {
      totalSize: string;
      totalKeys: number;
      usage: string;
    };
  }> {
    const cacheService = TaskCacheService.getInstance();
    const storageManager = StorageManager.getInstance();
    
    const [cacheStats, storageReport] = await Promise.all([
      cacheService.getCacheStats(),
      storageManager.getStorageReport()
    ]);

    return {
      initialized: this.initialized,
      cacheStats,
      storageStats: storageReport.summary
    };
  }

  // Cleanup risorse quando l'app viene chiusa
  cleanup(): void {
    console.log('[APP_INIT] Cleanup risorse app');
    
    const syncManager = SyncManager.getInstance();
    syncManager.cleanup();
    
    this.initialized = false;
  }

  // Reset completo per debug/troubleshooting
  async reset(): Promise<void> {
    console.log('[APP_INIT] RESET COMPLETO DELL\'APP!');
    
    const cacheService = TaskCacheService.getInstance();
    const storageManager = StorageManager.getInstance();
    
    await cacheService.clearCache();
    await storageManager.resetStorage();
    
    this.initialized = false;
    
    // Reinizializza
    await this.initialize();
  }
}

export default AppInitializer;