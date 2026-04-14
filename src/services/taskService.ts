import axios from "./axiosInterceptor";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/authConstants";
import TaskCacheService from './TaskCacheService';
import SyncManager from './SyncManager';
import { emitTaskAdded, emitTaskUpdated, emitTaskDeleted, emitTasksSynced } from '../utils/eventEmitter';

// Lazy initialization dei servizi per evitare problemi di caricamento
let cacheService: TaskCacheService | null = null;
let syncManager: SyncManager | null = null;

function getServices() {
  if (!cacheService) {
    cacheService = TaskCacheService.getInstance();
  }
  if (!syncManager) {
    syncManager = SyncManager.getInstance();
  }
  return { cacheService, syncManager };
}

// Definizione dell'interfaccia Task
export interface Task {
  title: string;
  description?: string;
  status: string; // Reso obbligatorio
  start_time?: string; // Aggiunto
  end_time?: string;
  priority?: string;
  category_name?: string; // Deprecato, mantenuto per retrocompatibilità
  category_id?: string | number; // Nuovo campo preferito
  user?: string;
  isOptimistic?: boolean; // Per indicare se il task è in stato ottimistico (in attesa di conferma server)

  // NEW RECURRING TASK FIELDS (API v2.2.0)
  is_recurring?: boolean; // Whether this is a recurring task
  recurrence_pattern?: string; // "daily", "weekly", or "monthly"
  recurrence_interval?: number; // Repeat every N days/weeks/months
  recurrence_days_of_week?: number[]; // Days of week for weekly pattern [1-7]
  recurrence_day_of_month?: number; // Day of month for monthly pattern (1-31)
  recurrence_end_type?: string; // "never", "after_count", or "on_date"
  recurrence_end_date?: string; // End date if end_type="on_date"
  recurrence_end_count?: number; // Max occurrences if end_type="after_count"
  recurrence_current_count?: number; // How many times task has been completed
  next_occurrence?: string; // When the task is next due (ISO 8601)
  last_completed_at?: string; // When the task was last completed (ISO 8601)

  // Task duration (API v2.1.0)
  duration_minutes?: number | null; // Estimated duration in minutes (1-10080, i.e. 1 min to 7 days)

  // DEPRECATED: Old recurring task system (kept for backward compatibility)
  is_generated_instance?: boolean; // Indicates if this task is a generated instance from a recurring template
  parent_template_id?: number; // ID of the parent recurring template (if this is an instance)

  [key: string]: any; // per proprietà aggiuntive
}

// Funzione per ottenere tutti gli impegni filtrandoli per categoria (con cache)
export async function getTasks(categoryIdentifier?: string | number, useCache: boolean = true, skipCorruptionCheck: boolean = false) {
  try {
    // Controllo autenticazione prima di fare chiamate API
    const { checkAndRefreshAuth } = await import('./authService');
    const authStatus = await checkAndRefreshAuth();

    if (!authStatus.isAuthenticated) {
      console.log('[TASK_SERVICE] getTasks: utente non autenticato, ritorno cache se disponibile');

      // Se non è autenticato, ritorna solo dati dalla cache se disponibili
      if (useCache) {
        const cachedTasks = await getServices().cacheService.getCachedTasks();
        console.log(`[TASK_SERVICE] getTasks: utente non loggato, ritornando ${cachedTasks.length} task dalla cache`);

        // Filtra per categoria se specificata
        if (categoryIdentifier) {
          const filteredTasks = cachedTasks.filter(task =>
            task.category_id === categoryIdentifier || task.category_name === categoryIdentifier
          );
          console.log(`[TASK_SERVICE] getTasks: filtrati ${filteredTasks.length} task per categoria "${categoryIdentifier}"`);
          return filteredTasks;
        }

        return cachedTasks;
      }

      // Se cache disabilitata e non autenticato, ritorna array vuoto
      console.log('[TASK_SERVICE] getTasks: utente non loggato e cache disabilitata, ritorno array vuoto');
      return [];
    }

    // Se richiesto, prova prima dalla cache
    if (useCache) {
      const { cacheService } = getServices();

      // Controlla e pulisce cache corrotta prima di usarla (skip se chiamata ricorsiva)
      if (!skipCorruptionCheck) {
        const cacheWasCleaned = await cacheService.checkAndFixCorruptedCache();
        if (cacheWasCleaned) {
          console.log('[TASK_SERVICE] Cache corrotta pulita, ricaricamento dall\'API...');
          // Forza il caricamento dall'API dopo aver pulito la cache, saltando il corruption check
          return getTasks(categoryIdentifier, false, true);
        }
      }

      const cachedTasks = await getServices().cacheService.getCachedTasks();
      if (cachedTasks.length > 0) {
        console.log('[TASK_SERVICE] Usando dati dalla cache');

        // Filtra per categoria se specificata
        if (categoryIdentifier !== undefined) {
          console.log(`[TASK_SERVICE] Filtraggio cache per categoria: "${categoryIdentifier}"`);
          console.log(`[TASK_SERVICE] Task totali in cache:`, cachedTasks.length);

          const filteredTasks = cachedTasks.filter(task => {
            // Prova prima con category_id (preferito) - confronta sia come numero che come stringa
            if (task.category_id !== undefined) {
              // Confronta convertendo entrambi a stringa per gestire "84" === 84
              if (task.category_id.toString() === categoryIdentifier.toString()) {
                return true;
              }
            }
            // Fallback su category_name per retrocompatibilità
            if (typeof categoryIdentifier === 'string') {
              const taskCategoryName = task.category_name;
              const exactMatch = taskCategoryName === categoryIdentifier;
              const normalizedTaskCategory = taskCategoryName?.trim().toLowerCase();
              const normalizedSearchCategory = categoryIdentifier.trim().toLowerCase();
              const normalizedMatch = normalizedTaskCategory === normalizedSearchCategory;
              return exactMatch || normalizedMatch;
            }
            return false;
          });

          console.log(`[TASK_SERVICE] Task filtrati dalla cache per "${categoryIdentifier}":`, filteredTasks.length);

          // Avvia sync in background
          getServices().syncManager.addSyncOperation('GET_TASKS', { categoryIdentifier });

          return filteredTasks;
        }

        // Avvia sync in background
        getServices().syncManager.addSyncOperation('GET_TASKS', {});

        return cachedTasks;
      }
    }

    // Fallback alla chiamata API diretta
    console.log('[TASK_SERVICE] Caricamento dalla API (cache vuota o disabilitata)');

    if (categoryIdentifier !== undefined) {
      // Usa il nuovo endpoint con category_id se è un numero, altrimenti usa il vecchio endpoint con category_name
      if (typeof categoryIdentifier === 'number' || !isNaN(Number(categoryIdentifier))) {
        console.log(`[TASK_SERVICE] Richiesta API per category_id: ${categoryIdentifier}`);
        const response = await axios.get(`/tasks/by-category-id/${categoryIdentifier}`, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        // Salva i task ricevuti in cache per uso futuro
        if (useCache && response.data && Array.isArray(response.data)) {
          const tasksToCache = response.data.map((task: Task) => ({
            ...task,
            id: task.task_id || task.id,
            task_id: task.task_id || task.id
          }));

          // Carica la cache esistente e aggiorna solo i task di questa categoria
          const { cacheService } = getServices();
          const existingTasks = await cacheService.getCachedTasks();
          const otherCategoryTasks = existingTasks.filter(t =>
            t.category_id !== categoryIdentifier && t.category_id?.toString() !== categoryIdentifier.toString()
          );
          const updatedCache = [...otherCategoryTasks, ...tasksToCache];
          const categories = await cacheService.getCachedCategories();

          await cacheService.saveTasks(updatedCache, categories);
        }

        return response.data;
      } else {
        // Fallback al vecchio endpoint per retrocompatibilità
        const encodedCategoryName = String(categoryIdentifier).replace(/ /g, "%20");
        const response = await axios.get(`/tasks/${encodedCategoryName}`, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        // Salva i task ricevuti in cache per uso futuro
        if (useCache && response.data && Array.isArray(response.data)) {
          const tasksToCache = response.data.map((task: Task) => ({
            ...task,
            category_name: task.category_name || categoryIdentifier,
            id: task.task_id || task.id,
            task_id: task.task_id || task.id
          }));

          // Carica la cache esistente e aggiorna solo i task di questa categoria
          const { cacheService } = getServices();
          const existingTasks = await cacheService.getCachedTasks();
          const otherCategoryTasks = existingTasks.filter(t =>
            t.category_name !== categoryIdentifier
          );
          const updatedCache = [...otherCategoryTasks, ...tasksToCache];
          const categories = await cacheService.getCachedCategories();

          await cacheService.saveTasks(updatedCache, categories);
        }

        return response.data;
      }
    }

    const response = await axios.get(`/tasks/`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Errore nel recupero dei task:", error);

    // In caso di errore, prova a restituire i dati cached come fallback
    if (useCache) {
      console.log('[TASK_SERVICE] Errore API, tentativo fallback cache');
      const cachedTasks = await getServices().cacheService.getCachedTasks();
      if (categoryIdentifier !== undefined) {
        console.log(`[TASK_SERVICE] Fallback cache per categoria: "${categoryIdentifier}"`);
        const filteredTasks = cachedTasks.filter(task => {
          if (task.category_id !== undefined && task.category_id === categoryIdentifier) {
            return true;
          }
          if (typeof categoryIdentifier === 'string') {
            const taskCategoryName = task.category_name;
            const exactMatch = taskCategoryName === categoryIdentifier;
            const normalizedTaskCategory = taskCategoryName?.trim().toLowerCase();
            const normalizedSearchCategory = categoryIdentifier.trim().toLowerCase();
            const normalizedMatch = normalizedTaskCategory === normalizedSearchCategory;
            return exactMatch || normalizedMatch;
          }
          return false;
        });
        console.log(`[TASK_SERVICE] Task fallback per "${categoryIdentifier}":`, filteredTasks.length);
        return filteredTasks;
      }
      return cachedTasks;
    }

    return [];
  }
}

// funzione che restistuise gli utimi impegni (con cache)
export async function getLastTask(last_n: number, useCache: boolean = true) {
  try {
    // Usa getAllTasks che ora funziona correttamente con cache
    const allTasks = await getAllTasks(useCache);
    
    if (!Array.isArray(allTasks) || allTasks.length === 0) {
      return [];
    }
    
    // restituisce gli ultimi n impegni
    let data = allTasks.slice(-last_n);
    // ordina gli impegni in base alla data di fine
    data.sort((a: Task, b: Task) => {
      // I task senza scadenza vanno in fondo
      if (!a.end_time && !b.end_time) return 0;
      if (!a.end_time) return 1;
      if (!b.end_time) return -1;
      
      return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
    });
    return data;

  } catch (error) {
    console.error("Errore nel recupero degli ultimi task:", error);
    return [];
  }
}
// funzione per ottenere tutti gli impegni (con cache)
export async function getAllTasks(useCache: boolean = true) {
  try {
    // Controllo autenticazione prima di fare chiamate API
    const { checkAndRefreshAuth } = await import('./authService');
    const authStatus = await checkAndRefreshAuth();

    if (!authStatus.isAuthenticated) {
      console.log('[TASK_SERVICE] getAllTasks: utente non autenticato, ritorno cache se disponibile');

      // Se non è autenticato, ritorna solo dati dalla cache se disponibili
      if (useCache) {
        const cachedTasks = await getServices().cacheService.getCachedTasks();
        console.log(`[TASK_SERVICE] getAllTasks: utente non loggato, ritornando ${cachedTasks.length} task dalla cache`);
        return cachedTasks;
      }

      // Se cache disabilitata e non autenticato, ritorna array vuoto
      console.log('[TASK_SERVICE] getAllTasks: utente non loggato e cache disabilitata, ritorno array vuoto');
      return [];
    }

    // Prova prima dalla cache se abilitata
    if (useCache) {
      const cachedTasks = await getServices().cacheService.getCachedTasks();
      if (cachedTasks.length > 0) {
        console.log('[TASK_SERVICE] getAllTasks: usando dati dalla cache');

        // Avvia sync in background
        getServices().syncManager.addSyncOperation('GET_TASKS', {});

        return cachedTasks;
      }
    }

    // Fallback alla logica originale
    console.log('[TASK_SERVICE] getAllTasks: caricamento dalla API');
    
    // Prima otteniamo tutte le categorie
    const categories = await getCategories(false); // Non usare cache per categorie in questo caso
    let allTasks: Task[] = [];
    
    if (categories && Array.isArray(categories)) {
      // Per ogni categoria, otteniamo i task
      for (const category of categories) {
        try {
          // Usa category_id se disponibile, altrimenti fallback su category.name
          const categoryIdentifier = category.category_id || category.id || category.name;
          console.log(`[getAllTasks] Recuperando task per categoria: "${category.name}" (ID: ${categoryIdentifier})`);
          const categoryTasks = await getTasks(categoryIdentifier, false); // Non usare cache per singole categorie

          if (Array.isArray(categoryTasks)) {
            // Correggi i task che hanno category_name/category_id undefined o mancante
            const correctedTasks = categoryTasks.map(task => {
              const needsCategoryIdFix = !task.category_id;
              const needsCategoryNameFix = !task.category_name || task.category_name === 'undefined';

              if (needsCategoryNameFix || needsCategoryIdFix) {
                console.log(`[getAllTasks] 🔧 Correggendo campi categoria per task "${task.title}" - category_name: ${task.category_name} → ${category.name}`);
                return {
                  ...task,
                  category_name: needsCategoryNameFix ? category.name : task.category_name,
                  category_id: needsCategoryIdFix ? (category.category_id || category.id) : task.category_id
                };
              }
              return task;
            });
            
            // Log di ogni task ricevuto per questa categoria
            correctedTasks.forEach((task, index) => {
              console.log(`[getAllTasks] Task ${index + 1} da "${category.name}": titolo="${task.title}", categoria="${task.category_name}", status="${task.status}"`);
            });
            
            allTasks = allTasks.concat(correctedTasks);
          }
        } catch (error) {
          console.warn(`Errore nel recupero task per categoria ${category.name}:`, error);
        }
      }
    }
    
    // Rimuovi duplicati basandosi sull'ID del task
    const uniqueTasks = allTasks.filter((task, index, self) => 
      index === self.findIndex((t) => t.task_id === task.task_id)
    );
    
    // Ordina i task per data di fine
    uniqueTasks.sort((a: Task, b: Task) => {
      // I task senza scadenza vanno in fondo
      if (!a.end_time && !b.end_time) return 0;
      if (!a.end_time) return 1;
      if (!b.end_time) return -1;
      
      return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
    });
    
    // Salva nella cache se abbiamo ottenuto dati validi
    if (useCache && uniqueTasks.length > 0) {
      await getServices().cacheService.saveTasks(uniqueTasks, categories);
    }
    
    console.log("[getAllTasks] Task totali recuperati:", uniqueTasks.length);
    return uniqueTasks;

  } catch (error) {
    console.error("Errore nel recupero di tutti i task:", error);
    
    // Fallback alla cache in caso di errore
    if (useCache) {
      console.log('[TASK_SERVICE] Errore API, tentativo fallback cache in getAllTasks');
      const cachedTasks = await getServices().cacheService.getCachedTasks();
      return cachedTasks;
    }
    
    return [];
  }
}

// Funzione per aggiornare un impegno esistente (con cache e offline)
export async function updateTask(
  taskId: string | number,
  updatedTask: Partial<Task>
) {
  try {
    const status = updatedTask.status;
    console.log(status)
    // Assicura che tutti i parametri richiesti siano inclusi
    // e che i valori nulli/undefined siano gestiti
    const taskData: any = {
      title: updatedTask.title,
      description: updatedTask.description || null, // Invia null se non definito
      start_time: updatedTask.start_time || null, // Invia null se non definito
      end_time: updatedTask.end_time || null,     // Invia null se non definito
      priority: updatedTask.priority || null,   // Invia null se non definito
      status: status,
    };

    // Add duration_minutes if provided (API v2.1.0) - supports null to remove duration
    if (updatedTask.duration_minutes !== undefined) {
      taskData.duration_minutes = updatedTask.duration_minutes;
    }

    // Usa category_id se disponibile (preferito), altrimenti fallback su category_name
    if (updatedTask.category_id !== undefined) {
      taskData.category_id = updatedTask.category_id;
    } else if (updatedTask.category_name !== undefined) {
      taskData.category_name = updatedTask.category_name;
    }

    console.log("Updating task with data:", taskData); // Log per debug

    // Aggiorna immediatamente la cache locale per UI reattiva
    const fullUpdatedTask = { ...updatedTask, id: taskId, task_id: taskId } as Task;
    await getServices().cacheService.updateTaskInCache(fullUpdatedTask);

    try {
      // Prova a inviare al server
      const response = await axios.put(`/tasks/${taskId}`, taskData, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      // Emetti evento per aggiornamento UI
      console.log('[TASK_SERVICE] Emitting TASK_UPDATED event for:', response.data.title || taskData.title);
      emitTaskUpdated({ ...taskData, id: taskId, task_id: taskId, ...response.data });
      
      return response.data;
    } catch (networkError) {
      console.log('[TASK_SERVICE] Errore di rete, salvataggio offline per updateTask', networkError);
      
      // Salva la modifica offline
      await getServices().syncManager.saveOfflineChange('UPDATE', 'TASK', {
        id: taskId,
        task_id: taskId,
        ...taskData
      });
      
      // Emetti evento anche per task offline
      console.log('[TASK_SERVICE] Emitting TASK_UPDATED event for offline task:', fullUpdatedTask.title);
      emitTaskUpdated(fullUpdatedTask);
      
      // Restituisci i dati locali (la cache è già aggiornata)
      return fullUpdatedTask;
    }
  } catch (error) {
    console.error("Error updating task:", error.response?.data || error.message); // Log dettagliato dell'errore
    throw error;
  }
}

// Funzione per segnare un task come completato (con optimistic update)
export async function completeTask(taskId: string | number) {
  try {
    console.log("[TASK_SERVICE] Completamento task con optimistic update:", taskId);
    
    // 1. OPTIMISTIC UPDATE: Aggiorna immediatamente la cache locale e l'UI
    const { cacheService } = getServices();
    const cachedTasks = await cacheService.getCachedTasks();
    const taskToUpdate = cachedTasks.find(task => 
      task.id === taskId || task.task_id === taskId
    );
    
    if (!taskToUpdate) {
      throw new Error("Task non trovato nella cache per completamento optimistic");
    }
    
    // Salva lo stato precedente per eventuale rollback
    const previousStatus = taskToUpdate.status;
    console.log("[TASK_SERVICE] Stato precedente task:", previousStatus, "-> Completato");
    
    // Aggiorna immediatamente la cache locale con flag optimistic
    const optimisticTask = { ...taskToUpdate, status: "Completato", isOptimistic: true };
    await cacheService.updateTaskInCache(optimisticTask);
    
    // Emetti immediatamente l'evento per aggiornare l'UI
    console.log("[TASK_SERVICE] Emitting optimistic TASK_UPDATED event for completion");
    emitTaskUpdated(optimisticTask);
    
    // 2. CONFERMA DAL SERVER: Prova a confermare con il server
    try {
      console.log("[TASK_SERVICE] Confermando completamento con il server...");
      
      const response = await axios.put(`/tasks/${taskId}`, {
        status: "Completato"
      }, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      console.log("[TASK_SERVICE] ✅ Completamento confermato dal server:", response.data);

      // Aggiorna con i dati definitivi dal server, rimuovendo il flag optimistic e pulendo eventuali flag temporanei
      const { isOptimistic: _, tempId: __, message: ___, ...cleanServerData } = response.data || {};
      const finalTask = {
        ...taskToUpdate,
        ...cleanServerData,
        status: "Completato",
        isOptimistic: false,
        // Preserva esplicitamente category_name e category_id dal task originale se non presenti nel server response
        category_name: cleanServerData.category_name || taskToUpdate.category_name,
        category_id: cleanServerData.category_id || taskToUpdate.category_id
      };
      await cacheService.updateTaskInCache(finalTask);

      // Emetti evento finale per confermare l'aggiornamento UI
      console.log("[TASK_SERVICE] Emitting final TASK_UPDATED event after server confirmation");
      emitTaskUpdated(finalTask);

      return finalTask;
      
    } catch (serverError) {
      console.error("[TASK_SERVICE] ❌ Errore server nel completamento, rollback:", serverError);
      
      // 3. ROLLBACK: Ripristina lo stato precedente
      const rollbackTask = { ...taskToUpdate, status: previousStatus, isOptimistic: false };
      await cacheService.updateTaskInCache(rollbackTask);
      emitTaskUpdated(rollbackTask);
      
      // Salva come modifica offline per retry successivo
      await getServices().syncManager.saveOfflineChange('UPDATE', 'TASK', {
        id: taskId,
        task_id: taskId,
        status: "Completato"
      });
      
      console.log("[TASK_SERVICE] Rollback completato, operazione salvata per sync offline");
      
      // Non lanciare errore perché l'operazione è comunque salvata offline
      return rollbackTask;
    }
    
  } catch (error) {
    console.error("Errore critico nel completare il task:", error);
    throw error;
  }
}

// Funzione per riaprire un task completato (con optimistic update)
export async function disCompleteTask(taskId: string | number) {
  try {
    console.log("[TASK_SERVICE] Riapertura task con optimistic update:", taskId);
    
    // 1. OPTIMISTIC UPDATE: Aggiorna immediatamente la cache locale e l'UI
    const { cacheService } = getServices();
    const cachedTasks = await cacheService.getCachedTasks();
    const taskToUpdate = cachedTasks.find(task => 
      task.id === taskId || task.task_id === taskId
    );
    
    if (!taskToUpdate) {
      throw new Error("Task non trovato nella cache per riapertura optimistic");
    }
    
    // Salva lo stato precedente per eventuale rollback
    const previousStatus = taskToUpdate.status;
    console.log("[TASK_SERVICE] Stato precedente task:", previousStatus, "-> In sospeso");
    
    // Aggiorna immediatamente la cache locale con flag optimistic
    const optimisticTask = { ...taskToUpdate, status: "In sospeso", isOptimistic: true };
    await cacheService.updateTaskInCache(optimisticTask);
    
    // Emetti immediatamente l'evento per aggiornare l'UI
    console.log("[TASK_SERVICE] Emitting optimistic TASK_UPDATED event for reopening");
    emitTaskUpdated(optimisticTask);
    
    // 2. CONFERMA DAL SERVER: Prova a confermare con il server
    try {
      console.log("[TASK_SERVICE] Confermando riapertura con il server...");
      
      const response = await axios.put(`/tasks/${taskId}`, {
        status: "In sospeso"
      }, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      console.log("[TASK_SERVICE] ✅ Riapertura confermata dal server:", response.data);

      // Aggiorna con i dati definitivi dal server, rimuovendo il flag optimistic e pulendo eventuali flag temporanei
      const { isOptimistic: _, tempId: __, message: ___, ...cleanServerData } = response.data || {};
      const finalTask = {
        ...taskToUpdate,
        ...cleanServerData,
        status: "In sospeso",
        isOptimistic: false,
        // Preserva esplicitamente category_name e category_id dal task originale se non presenti nel server response
        category_name: cleanServerData.category_name || taskToUpdate.category_name,
        category_id: cleanServerData.category_id || taskToUpdate.category_id
      };
      await cacheService.updateTaskInCache(finalTask);

      // Emetti evento finale per confermare l'aggiornamento UI
      console.log("[TASK_SERVICE] Emitting final TASK_UPDATED event after server confirmation");
      emitTaskUpdated(finalTask);

      return finalTask;
      
    } catch (serverError) {
      console.error("[TASK_SERVICE] ❌ Errore server nella riapertura, rollback:", serverError);
      
      // 3. ROLLBACK: Ripristina lo stato precedente
      const rollbackTask = { ...taskToUpdate, status: previousStatus, isOptimistic: false };
      await cacheService.updateTaskInCache(rollbackTask);
      emitTaskUpdated(rollbackTask);
      
      // Salva come modifica offline per retry successivo
      await getServices().syncManager.saveOfflineChange('UPDATE', 'TASK', {
        id: taskId,
        task_id: taskId,
        status: "In sospeso"
      });
      
      console.log("[TASK_SERVICE] Rollback completato, operazione salvata per sync offline");
      
      // Non lanciare errore perché l'operazione è comunque salvata offline
      return rollbackTask;
    }
    
  } catch (error) {
    console.error("Errore critico nel riaprire il task:", error);
    throw error;
  }
}

// Funzione per eliminare un impegno (con cache e offline)
export async function deleteTask(taskId: string | number) {
  try {
    console.log("Eliminazione dell'impegno con ID:", taskId);
    
    // Rimuovi immediatamente dalla cache locale per UI reattiva
    await getServices().cacheService.removeTaskFromCache(taskId);
    
    try {
      // Prova a eliminare dal server
      const response = await axios.delete(`/tasks/${taskId}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      // Emetti evento per aggiornamento UI
      console.log('[TASK_SERVICE] Emitting TASK_DELETED event for taskId:', taskId);
      emitTaskDeleted(taskId);
      
      return response.data;
    } catch (networkError) {
      console.log('[TASK_SERVICE] Errore di rete, salvataggio offline per deleteTask', networkError);

      // Salva l'eliminazione offline
      await getServices().syncManager.saveOfflineChange('DELETE', 'TASK', {
        id: taskId,
        task_id: taskId
      });
      
      // Emetti evento anche per eliminazione offline
      console.log('[TASK_SERVICE] Emitting TASK_DELETED event for offline deletion:', taskId);
      emitTaskDeleted(taskId);
      
      // Restituisci successo (la cache è già aggiornata)
      return { success: true, offline: true };
    }
  } catch (error) {
    throw error;
  }
}

// Funzione per aggiungere un nuovo impegno (con cache e offline)
export async function addTask(task: Task) {
  try {
    const username = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);

    // converti la priorita` da numero a stringa (1: bassa, 2: media, 3: alta)
    if (task.priority) {
      if (typeof task.priority === 'number') {
        task.priority = task.priority === 1 ? 'Bassa' : task.priority === 2 ? 'Media' : 'Alta';
      }
    }

    // Assicurati che le date siano nel formato corretto
    const startTime = task.start_time ? new Date(task.start_time) : new Date();
    const endTime = task.end_time ? new Date(task.end_time) : null;

    // Validazione: end_time deve essere successiva a start_time
    if (endTime && endTime <= startTime) {
      console.warn("⚠️ ATTENZIONE: end_time è precedente o uguale a start_time");
      console.warn("start_time:", startTime.toISOString());
      console.warn("end_time:", endTime.toISOString());
    }

    const data: any = {
      title: task.title,
      description: task.description || "",
      start_time: startTime.toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
      priority: task.priority,
      status: task.status || "In sospeso",
      user: task.user || username,
    };

    // Add duration_minutes if provided (API v2.1.0)
    if (task.duration_minutes !== undefined) {
      data.duration_minutes = task.duration_minutes;
    }

    // Includi category_id e category_name se disponibili (entrambi necessari per cache e API)
    if (task.category_id !== undefined) {
      data.category_id = task.category_id;
    }
    if (task.category_name !== undefined) {
      data.category_name = task.category_name;
    }

    // Add recurring task data if this is a recurring task
    if (task.is_recurring) {
      data.is_recurring = true;
      data.recurrence = {
        pattern: task.recurrence_pattern,
        interval: task.recurrence_interval || 1,
        end_type: task.recurrence_end_type || "never",
      };

      // Add pattern-specific fields
      if (task.recurrence_pattern === "weekly" && task.recurrence_days_of_week) {
        data.recurrence.days_of_week = task.recurrence_days_of_week;
      }
      if (task.recurrence_pattern === "monthly" && task.recurrence_day_of_month) {
        data.recurrence.day_of_month = task.recurrence_day_of_month;
      }

      // Add end-type-specific fields
      if (task.recurrence_end_type === "on_date" && task.recurrence_end_date) {
        data.recurrence.end_date = task.recurrence_end_date;
      }
      if (task.recurrence_end_type === "after_count" && task.recurrence_end_count) {
        data.recurrence.end_count = task.recurrence_end_count;
      }
    }
    
    // Genera un ID temporaneo per il task locale
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Per task ricorrenti, espandi i campi ricorrenza al livello top-level (da data.recurrence nested)
    const tempRecurringFields = data.is_recurring && data.recurrence ? {
      recurrence_pattern: data.recurrence.pattern,
      recurrence_interval: data.recurrence.interval ?? 1,
      recurrence_end_type: data.recurrence.end_type || 'never',
      recurrence_days_of_week: data.recurrence.days_of_week,
      recurrence_day_of_month: data.recurrence.day_of_month,
    } : {};
    const tempTask = { ...data, ...tempRecurringFields, id: tempId, task_id: tempId };
    
    // Aggiungi immediatamente alla cache locale per UI reattiva
    await getServices().cacheService.updateTaskInCache(tempTask);
    
    console.log("data: ", data);
    console.log("Date formats - start_time:", data.start_time, "end_time:", data.end_time);
    console.log("Sending POST request to /tasks with headers:", {
      "Content-Type": "application/json",
    });
    
    try {
      // Prova a inviare al server
      const response = await axios.post("/tasks", data, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      console.log("Task creation response:", response.data);
      
      // Aggiorna la cache con l'ID reale del server SENZA rimuovere il task temporaneo
      if (response.data && response.data.task_id) {
        // Se il task era ricorrente, garantiamo che i campi ricorrenza siano preservati
        // anche se il server non li restituisce nella response (o li restituisce null)
        const recurringOverrides = data.is_recurring ? {
          is_recurring: true,
          recurrence_pattern: response.data.recurrence_pattern || data.recurrence?.pattern,
          recurrence_interval: response.data.recurrence_interval ?? data.recurrence?.interval ?? 1,
          recurrence_end_type: response.data.recurrence_end_type || data.recurrence?.end_type || 'never',
          recurrence_days_of_week: response.data.recurrence_days_of_week || data.recurrence?.days_of_week,
          recurrence_day_of_month: response.data.recurrence_day_of_month || data.recurrence?.day_of_month,
          recurrence_end_date: response.data.recurrence_end_date || data.recurrence?.end_date,
          recurrence_end_count: response.data.recurrence_end_count || data.recurrence?.end_count,
        } : {};

        const serverTask = {
          ...data, // Usa i dati originali puliti
          ...response.data, // Sovrascrivi con i dati del server
          ...recurringOverrides, // Ripristina i campi ricorrenza se il server non li restituisce
          id: response.data.task_id, // Usa l'ID del server
          task_id: response.data.task_id, // Assicurati che anche task_id sia impostato
          tempId: tempId // Mantieni il riferimento al temp ID per la cache
        };

        // AGGIORNA il task esistente invece di rimuoverlo e ri-aggiungerlo
        await getServices().cacheService.updateTaskInCache(serverTask);

        // Emetti evento per aggiornamento UI
        console.log('[TASK_SERVICE] Emitting TASK_ADDED event for:', serverTask.title);
        emitTaskAdded(serverTask);
      }
      
      return response.data;
    } catch (networkError) {
      console.log('[TASK_SERVICE] Errore di rete, salvataggio offline per addTask', networkError);

      // Salva l'aggiunta offline
      await getServices().syncManager.saveOfflineChange('CREATE', 'TASK', data);
      
      // Emetti evento anche per task offline
      console.log('[TASK_SERVICE] Emitting TASK_ADDED event for offline task:', tempTask.title);
      emitTaskAdded(tempTask);
      
      // Restituisci il task temporaneo (già in cache)
      return tempTask;
    }
  } catch (error) {
    console.error("Errore durante l'aggiunta del task:", error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
      console.error("Response headers:", error.response.headers);
    }
    throw error;
  }
}

// Funzione per aggiungere una nuova categoria
export async function addCategory(category: {
  id?: string | number;  // Reso opzionale per compatibilità con l'oggetto passato
  name: string;
  description?: string;
}) {
  try {
    // Estrai solo le proprietà rilevanti per l'API
    const categoryData = {
      name: category.name,
      description: category.description || ""
    };
    
    console.log("Invio categoria al server:", categoryData);
    
    const response = await axios.post("/categories", categoryData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    // Aggiungi l'id alla risposta se non è presente
    const responseData = response.data;
    if (!responseData.id && category.id) {
      responseData.id = category.id;
    }

    // Aggiorna la cache con la nuova categoria
    const currentTasks = await getServices().cacheService.getCachedTasks();
    const currentCategories = await getServices().cacheService.getCachedCategories();

    // Aggiungi la nuova categoria alla lista esistente
    const newCategory = {
      id: responseData.category_id || responseData.id || category.id,
      name: categoryData.name,
      description: categoryData.description,
      category_id: responseData.category_id,
      status_code: responseData.status_code
    };

    const updatedCategories = [...currentCategories, newCategory];
    await getServices().cacheService.saveTasks(currentTasks, updatedCategories);
    console.log(`[TASK_SERVICE] Nuova categoria "${categoryData.name}" aggiunta alla cache`);

    console.log("Risposta dal server:", responseData);
    return responseData;
  } catch (error) {
    console.error("Errore in addCategory:", error);
    throw error;
  }
}

// Funzione per ottenere tutte le categorie (con cache)
export async function getCategories(useCache: boolean = true) {
  try {
    // Controllo autenticazione prima di fare chiamate API
    const { checkAndRefreshAuth } = await import('./authService');
    const authStatus = await checkAndRefreshAuth();

    if (!authStatus.isAuthenticated) {
      console.log('[TASK_SERVICE] getCategories: utente non autenticato, ritorno cache se disponibile');

      // Se non è autenticato, ritorna solo dati dalla cache se disponibili
      if (useCache) {
        const cachedCategories = await getServices().cacheService.getCachedCategories();
        console.log(`[TASK_SERVICE] getCategories: utente non loggato, ritornando ${cachedCategories.length} categorie dalla cache`);
        return cachedCategories;
      }

      // Se cache disabilitata e non autenticato, ritorna array vuoto
      console.log('[TASK_SERVICE] getCategories: utente non loggato e cache disabilitata, ritorno array vuoto');
      return [];
    }

    // Prova prima dalla cache se abilitata
    if (useCache) {
      const cachedCategories = await getServices().cacheService.getCachedCategories();
      if (cachedCategories.length > 0) {
        console.log('[TASK_SERVICE] Usando categorie dalla cache');

        // Avvia sync in background
        getServices().syncManager.addSyncOperation('GET_TASKS', {});

        return cachedCategories;
      }
    }

    // Fallback alla chiamata API diretta
    console.log('[TASK_SERVICE] Caricamento categorie dalla API');
    const response = await axios.get(`/categories`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const categories = response.data;

    // Aggiorna la cache con le nuove categorie
    const currentTasks = await getServices().cacheService.getCachedTasks();
    await getServices().cacheService.saveTasks(currentTasks, categories);
    console.log('[TASK_SERVICE] Cache categorie aggiornata');

    return categories;
  } catch (error) {
    console.error("Errore nel recupero delle categorie:", error);
    
    // In caso di errore, prova a restituire le categorie cached come fallback
    if (useCache) {
      console.log('[TASK_SERVICE] Errore API categorie, tentativo fallback cache');
      const cachedCategories = await getServices().cacheService.getCachedCategories();
      return cachedCategories;
    }
    
    throw error;
  }
}

// Funzione per eliminare una categoria tramite il suo ID (o nome come fallback)
export async function deleteCategory(
  categoryId: string | number,
  categoryName?: string,
  deleteFromGoogleCalendar?: boolean
) {
  try {
    console.log(`[TASK_SERVICE] Eliminazione categoria ID: ${categoryId}, nome: ${categoryName || 'N/A'}, google_calendar: ${deleteFromGoogleCalendar ?? false}`);

    const params: Record<string, string> = {};
    if (deleteFromGoogleCalendar) {
      params.delete_from_google_calendar = 'true';
    }

    const response = await axios.delete(`/categories/id/${categoryId}`, {
      headers: {
        "Content-Type": "application/json",
      },
      params,
    });

    // Rimuovi la categoria dalla cache dopo l'eliminazione riuscita
    await getServices().cacheService.removeCategoryFromCache(categoryId, categoryName);
    console.log(`[TASK_SERVICE] Categoria "${categoryId}" rimossa dalla cache`);

    return response.data;
  } catch (error) {
    console.error("Errore nell'eliminazione della categoria:", error);
    throw error;
  }
}

// Funzione per aggiornare una categoria esistente tramite ID (o nome come fallback)
export async function updateCategory(
  categoryId: string | number, 
  updatedCategory: { 
    name: string; 
    description?: string;
  }
) {
  try {
    console.log(`[TASK_SERVICE] Aggiornamento categoria ID: ${categoryId}`);
    const response = await axios.put(`/categories/id/${categoryId}`, updatedCategory, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Errore nell'aggiornamento della categoria:", error);
    throw error;
  }
}

// Funzione per sincronizzare tutti i dati (impegni e categorie) e salvarli nella cache
export async function syncAllData() {
  try {
    console.log('[SYNC] 📱 Avvio sincronizzazione completa dati...');

    // Fetch di tutti i dati in parallelo
    const [allTasks, allCategories] = await Promise.all([
      getAllTasks(false), // forza il fetch dall'API
      getCategories(false) // forza il fetch dall'API
    ]);

    console.log(`[SYNC] ✅ Sincronizzazione completata: ${allTasks.length} task e ${allCategories.length} categorie`);

    // Salva tutto nella cache
    if (allTasks.length > 0 || allCategories.length > 0) {
      await getServices().cacheService.saveTasks(allTasks, allCategories);
      console.log('[SYNC] 💾 Dati salvati nella cache locale');

      // Emetti evento per notificare la sincronizzazione
      emitTasksSynced(allTasks, allCategories);
    }

    return { tasks: allTasks, categories: allCategories };
  } catch (error) {
    console.error('[SYNC] ❌ Errore durante la sincronizzazione:', error);

    // In caso di errore, restituisci i dati dalla cache come fallback
    const cachedTasks = await getServices().cacheService.getCachedTasks();
    const cachedCategories = await getServices().cacheService.getCachedCategories();

    console.log(`[SYNC] 📂 Fallback su cache: ${cachedTasks.length} task e ${cachedCategories.length} categorie`);
    return { tasks: cachedTasks, categories: cachedCategories };
  }
}
