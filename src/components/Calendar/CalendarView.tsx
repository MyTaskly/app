import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator, Animated, Dimensions } from 'react-native';
import dayjs from 'dayjs';
import { Task as TaskType, getAllTasks, addTask, deleteTask, updateTask, completeTask, disCompleteTask } from '../../services/taskService';
import { TaskCacheService } from '../../services/TaskCacheService';
import SyncManager, { SyncStatus } from '../../services/SyncManager';
import AppInitializer from '../../services/AppInitializer';
import eventEmitter, { EVENTS } from '../../utils/eventEmitter';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import CalendarGrid from './CalendarGrid';
import Task from '../Task/Task';
import AddTask from '../Task/AddTask';
import AddTaskButton from '../Task/AddTaskButton';
import { addTaskToList } from '../TaskList/types';

const CalendarView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Screen dimensions
  const screenWidth = Dimensions.get('window').width;

  // Servizi
  const cacheService = useRef(TaskCacheService.getInstance()).current;
  const syncManager = useRef(SyncManager.getInstance()).current;
  const appInitializer = useRef(AppInitializer.getInstance()).current;
  
  // Animazioni per i punti di caricamento
  const fadeAnim1 = useRef(new Animated.Value(0.3)).current;
  const fadeAnim2 = useRef(new Animated.Value(0.3)).current;
  const fadeAnim3 = useRef(new Animated.Value(0.3)).current;

  // Funzione per sanitizzare le stringhe
  const sanitizeString = (value: any): string => {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  };

  // Funzione per filtrare task completati (coerente con Category.tsx)
  const filterIncompleteTasks = useCallback((tasks: TaskType[]) => {
    return tasks.filter(task => {
      const status = task.status?.toLowerCase() || '';
      const isIncomplete = status !== "completato" && status !== "completed" && status !== "archiviato" && status !== "archived";
      console.log(`[CALENDAR] Filtro task "${task.title}": status="${status}", incluso=${isIncomplete}`);
      return isIncomplete;
    });
  }, []);

  // Funzione per caricare gli impegni (con cache e supporto caricamento sincrono)
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log("[CALENDAR] Inizio caricamento task...");
      
      // Controlla se AppInitializer ha già i dati pronti
      if (appInitializer.isDataReady()) {
        console.log("[CALENDAR] Dati già caricati da AppInitializer");
        const cachedTasks = await cacheService.getCachedTasks();
        if (cachedTasks.length > 0) {
          console.log("[CALENDAR] Task dalla cache AppInitializer:", cachedTasks.length);
          const filteredTasks = filterIncompleteTasks(cachedTasks);
          console.log("[CALENDAR] Task non completati:", filteredTasks.length, "di", cachedTasks.length);
          setTasks(filteredTasks);
          setIsLoading(false);
          return;
        }
      }
      
      // Se AppInitializer sta ancora caricando, aspetta con timeout breve
      const dataReady = await appInitializer.waitForDataLoad(3000); // 3 secondi max
      if (dataReady) {
        console.log("[CALENDAR] Dati pronti dopo attesa AppInitializer");
        const cachedTasks = await cacheService.getCachedTasks();
        if (cachedTasks.length > 0) {
          console.log("[CALENDAR] Task dalla cache (post-wait):", cachedTasks.length);
          const filteredTasks = filterIncompleteTasks(cachedTasks);
          console.log("[CALENDAR] Task non completati:", filteredTasks.length, "di", cachedTasks.length);
          setTasks(filteredTasks);
          setIsLoading(false);
          return;
        }
      }
      
      // Fallback al comportamento originale se AppInitializer non è pronto
      console.log("[CALENDAR] Fallback al caricamento cache/API diretto");
      
      // Prima carica dalla cache per UI immediata
      const cachedTasks = await cacheService.getCachedTasks();
      if (cachedTasks.length > 0) {
        console.log("[CALENDAR] Task dalla cache:", cachedTasks.length);
        const filteredCachedTasks = filterIncompleteTasks(cachedTasks);
        console.log("[CALENDAR] Task non completati dalla cache:", filteredCachedTasks.length, "di", cachedTasks.length);
        setTasks(filteredCachedTasks);
        setIsLoading(false); // UI immediatamente reattiva
      }
      
      // Poi carica dal server/cache con sync in background
      const tasksData = await getAllTasks(true); // usa cache con sync background
      console.log("[CALENDAR] Task ricevuti:", tasksData);
      if (Array.isArray(tasksData)) {
        const filteredTasksData = filterIncompleteTasks(tasksData);
        console.log("[CALENDAR] Task non completati ricevuti:", filteredTasksData.length, "di", tasksData.length);
        setTasks(filteredTasksData);
        console.log("[CALENDAR] Task impostati correttamente:", filteredTasksData.length, "task non completati");
      } else {
        console.warn("[CALENDAR] I dati ricevuti non sono un array:", tasksData);
      }
    } catch (error) {
      console.error("[CALENDAR] Errore nel recupero degli impegni:", error);
      if (error.response) {
        console.error("[CALENDAR] Dettagli errore:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      // In caso di errore, usa solo la cache se disponibile
      const cachedTasks = await cacheService.getCachedTasks();
      if (cachedTasks.length > 0) {
        const filteredFallbackTasks = filterIncompleteTasks(cachedTasks);
        console.log("[CALENDAR] Utilizzando cache come fallback:", filteredFallbackTasks.length, "task non completati di", cachedTasks.length);
        setTasks(filteredFallbackTasks);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheService, appInitializer, filterIncompleteTasks]);

  // Setup listener per stato sync
  useEffect(() => {
    const handleSyncStatus = (status: SyncStatus) => {
      setSyncStatus(status);
    };
    
    syncManager.addSyncListener(handleSyncStatus);
    
    // Ottieni stato iniziale
    syncManager.getSyncStatus().then(setSyncStatus);
    
    return () => {
      syncManager.removeSyncListener(handleSyncStatus);
    };
  }, [syncManager]);

  // Setup listeners per eventi task in tempo reale
  useEffect(() => {
    const handleTaskAdded = (newTask: TaskType) => {
      console.log('[CALENDAR] Task added event received:', newTask.title);
      // Solo aggiungi task non completati
      const isIncompleteTask = filterIncompleteTasks([newTask]).length > 0;
      if (!isIncompleteTask) {
        console.log('[CALENDAR] Task completato ignorato:', newTask.title);
        return;
      }
      
      setTasks(prevTasks => {
        // Evita duplicati
        if (prevTasks.some(task => 
          (task.id === newTask.id) || 
          (task.task_id === newTask.task_id) ||
          (newTask.id && task.task_id === newTask.id) ||
          (newTask.task_id && task.id === newTask.task_id)
        )) {
          return prevTasks;
        }
        return [...prevTasks, newTask];
      });
    };

    const handleTaskUpdated = (updatedTask: TaskType) => {
      console.log('[CALENDAR] Task updated event received:', updatedTask.title);
      
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(task => {
          // Trova il task by ID o task_id
          const isMatch = (task.id === updatedTask.id) || 
                         (task.task_id === updatedTask.task_id) ||
                         (updatedTask.id && task.task_id === updatedTask.id) ||
                         (updatedTask.task_id && task.id === updatedTask.task_id);
          
          if (isMatch) {
            return { ...task, ...updatedTask };
          }
          return task;
        });
        
        // Filtra i task per rimuovere quelli completati
        const filteredTasks = updatedTasks.filter(task => {
          const keepTask = filterIncompleteTasks([task]).length > 0;
          if (!keepTask) {
            console.log('[CALENDAR] Rimuovendo task completato dalla vista:', task.title);
          }
          return keepTask;
        });
        
        return filteredTasks;
      });
    };

    const handleTaskDeleted = (taskId: string | number) => {
      console.log('[CALENDAR] Task deleted event received:', taskId);
      setTasks(prevTasks => 
        prevTasks.filter(task => 
          task.id !== taskId && task.task_id !== taskId
        )
      );
    };

    // Registra i listeners
    eventEmitter.on(EVENTS.TASK_ADDED, handleTaskAdded);
    eventEmitter.on(EVENTS.TASK_UPDATED, handleTaskUpdated);
    eventEmitter.on(EVENTS.TASK_DELETED, handleTaskDeleted);

    return () => {
      // Rimuovi i listeners
      eventEmitter.off(EVENTS.TASK_ADDED, handleTaskAdded);
      eventEmitter.off(EVENTS.TASK_UPDATED, handleTaskUpdated);
      eventEmitter.off(EVENTS.TASK_DELETED, handleTaskDeleted);
    };
  }, [filterIncompleteTasks]);

  // Carica gli impegni quando il componente si monta
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Aggiorna gli impegni quando la schermata riceve il focus
  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  // Naviga al mese precedente
  const goToPreviousMonth = () => {
    const newDate = dayjs(selectedDate).subtract(1, 'month').format('YYYY-MM-DD');
    setSelectedDate(newDate);
  };
  
  // Naviga al mese successivo
  const goToNextMonth = () => {
    const newDate = dayjs(selectedDate).add(1, 'month').format('YYYY-MM-DD');
    setSelectedDate(newDate);
  };
  
  // Seleziona una data specifica
  const selectDate = (date: string | null) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  // Ottieni gli impegni per la data selezionata
  const getTasksForSelectedDate = () => {
    return tasks.filter(task => {
      // Escludi i task senza data di scadenza
      if (!task.end_time) {
        return false;
      }

      const taskDate = dayjs(task.end_time).format('YYYY-MM-DD');
      return taskDate === selectedDate;
    }).map(task => {
      // Normalizza il task per assicurare che abbia sempre la proprietà `id`
      // Il componente Task usa `task.id` quindi dobbiamo garantire che sia presente
      if (!task.id && task.task_id) {
        return { ...task, id: task.task_id };
      }
      if (task.id && !task.task_id) {
        return { ...task, task_id: task.id };
      }
      return task;
    });
  };

  // Gestisce il completamento di un task
  const handleTaskComplete = async (taskId: number | string) => {
    try {
      await completeTask(taskId);
      setTasks(prev => prev.map(task =>
        (task.id === taskId || task.task_id === taskId)
          ? { ...task, status: "Completato", completed: true }
          : task
      ));
      // Ricarica i task per aggiornare il calendario
      fetchTasks();
    } catch (error) {
      console.error("Errore nel completamento del task:", error);
      Alert.alert("Errore", "Impossibile completare il task. Riprova.");
    }
  };

  // Gestisce l'annullamento del completamento di un task
  const handleTaskUncomplete = async (taskId: number | string) => {
    try {
      await disCompleteTask(taskId);
      setTasks(prev => prev.map(task =>
        (task.id === taskId || task.task_id === taskId)
          ? { ...task, status: "In sospeso", completed: false }
          : task
      ));
      // Ricarica i task per aggiornare il calendario
      fetchTasks();
    } catch (error) {
      console.error("Errore nell'annullamento del completamento del task:", error);
      Alert.alert("Errore", "Impossibile riaprire il task. Riprova.");
    }
  };

  // Gestisce la modifica di un task
  const handleTaskEdit = async (taskId: number | string, updatedTask: TaskType) => {
    try {
      await updateTask(taskId, updatedTask);
      setTasks(prev => prev.map(task => 
        (task.id === taskId || task.task_id === taskId) 
          ? updatedTask 
          : task
      ));
      // Ricarica i task per aggiornare il calendario
      fetchTasks();
    } catch (error) {
      console.error("Errore nella modifica del task:", error);
      Alert.alert("Errore", "Impossibile modificare il task. Riprova.");
    }
  };

  // Gestisce l'eliminazione di un task
  const handleTaskDelete = async (taskId: number | string) => {
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(task => 
        task.id !== taskId && task.task_id !== taskId
      ));
    } catch (error) {
      console.error("Errore nell'eliminazione del task:", error);
      Alert.alert("Errore", "Impossibile eliminare il task. Riprova.");
    }
  };

  // Gestisce l'apertura del form per aggiungere un task
  const handleAddTask = () => {
    setShowAddTask(true);
  };

  // Gestisce la chiusura del form
  const handleCloseAddTask = () => {
    setShowAddTask(false);
  };

  // Gestisce il salvataggio di un nuovo task
  const handleSaveTask = async (
    title: string,
    description: string,
    dueDate: string,
    priority: number,
    categoryNameParam?: string
  ) => {
    const priorityString = priority === 1 ? "Bassa" : priority === 2 ? "Media" : "Alta";
    // Costruisci nuovo task con data di inizio dal calendario
    const category = categoryNameParam || "Calendario";
    const newTask = {
      id: Date.now(),
      title: title.trim(),
      description: description || "",
      start_time: dayjs(selectedDate).toISOString(),
      end_time: new Date(dueDate).toISOString(),
      priority: priorityString,
      status: "In sospeso",
      category_name: category,
    };
    try {
      const response = await addTask({ ...newTask, category_name: category });
      if (response && response.status_code && response.task_id && !response.title) {
        const finalTask = { ...newTask, id: response.task_id, task_id: response.task_id, status_code: response.status_code };
        addTaskToList(finalTask, category);
      } else if (response && response.title) {
        addTaskToList(response, category);
      } else {
        addTaskToList(newTask, category);
      }
      setShowAddTask(false);
    } catch (error) {
      console.error("Errore aggiunta task nel calendario:", error);
      addTaskToList(newTask, category);
      Alert.alert(
        "Attenzione",
        "Task aggiunto localmente ma errore nel salvataggio sul server."
      );
      setShowAddTask(false);
    }
  };

  // Componente di caricamento
  const LoadingComponent = () => {
    // Avvia l'animazione dei punti quando il componente viene montato
    useEffect(() => {
      const animateSequence = () => {
        const duration = 600;
        const delay = 200;

        const animate = (animValue: Animated.Value, startDelay: number) => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(animValue, {
                toValue: 1,
                duration: duration,
                delay: startDelay,
                useNativeDriver: true,
              }),
              Animated.timing(animValue, {
                toValue: 0.3,
                duration: duration,
                useNativeDriver: true,
              }),
            ])
          ).start();
        };

        animate(fadeAnim1, 0);
        animate(fadeAnim2, delay);
        animate(fadeAnim3, delay * 2);
      };

      animateSequence();
    }, []);

    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>Caricamento impegni...</Text>
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.dot, { opacity: fadeAnim1 }]} />
            <Animated.View style={[styles.dot, { opacity: fadeAnim2 }]} />
            <Animated.View style={[styles.dot, { opacity: fadeAnim3 }]} />
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.calendarContainer}>
        {/* Griglia del calendario (sempre visibile) */}
        <CalendarGrid
          selectedDate={selectedDate}
          tasks={[]} // Lista vuota durante il caricamento
          onSelectDate={selectDate}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />
        
        {/* Header con effetto di caricamento e indicatore sync */}
        <View style={styles.selectedDateHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.selectedDateTitle}>
              Impegni del {dayjs(selectedDate).format('DD MMMM YYYY')}
            </Text>
          </View>
          <AddTaskButton onPress={handleAddTask} screenWidth={screenWidth} />
        </View>

        {/* Componente di caricamento */}
        <LoadingComponent />
        
        {/* Componente AddTask */}
        <AddTask 
          visible={showAddTask} 
          onClose={handleCloseAddTask}
          onSave={handleSaveTask}
          allowCategorySelection={true}
          categoryName="Calendario"
          initialDate={selectedDate}
        />
      </View>
    );
  }

  return (
    <View style={styles.calendarContainer}>
      {/* Griglia del calendario */}
      <CalendarGrid
        selectedDate={selectedDate}
        tasks={tasks}
        onSelectDate={selectDate}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
      />
      
      {/* Intestazione con titolo, indicatori sync e pulsante per aggiungere task */}
      <View style={styles.selectedDateHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.selectedDateTitle}>
            Impegni del {dayjs(selectedDate).format('DD MMMM YYYY')}
          </Text>
          {syncStatus && (
            <View style={styles.syncIndicator}>
              {syncStatus.isSyncing ? (
                <View style={styles.syncingContainer}>
                  <ActivityIndicator size="small" color="#666666" />
                  <Text style={styles.syncText}>Sync...</Text>
                </View>
              ) : !syncStatus.isOnline ? (
                <View style={styles.offlineContainer}>
                  <Ionicons name="cloud-offline-outline" size={16} color="#ff6b6b" />
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              ) : syncStatus.pendingChanges > 0 ? (
                <View style={styles.pendingContainer}>
                  <Ionicons name="sync-outline" size={16} color="#ffa726" />
                  <Text style={styles.pendingText}>{syncStatus.pendingChanges}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
        <AddTaskButton onPress={handleAddTask} screenWidth={screenWidth} />
      </View>

      <ScrollView style={styles.taskList}>
        {getTasksForSelectedDate().length > 0 ? (
          getTasksForSelectedDate().map((task) => (
            <Task
              key={task.task_id || task.id || `task-${sanitizeString(task.title)}-${task.start_time || Date.now()}`}
              task={task}
              onTaskComplete={handleTaskComplete}
              onTaskUncomplete={handleTaskUncomplete}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
            />
          ))
        ) : (
          <View style={styles.noTasksContainer}>
            <Ionicons name="calendar-outline" size={48} color="#cccccc" />
            <Text style={styles.noTasksText}>
              Nessun impegno per questa data
            </Text>
            <AddTaskButton onPress={handleAddTask} screenWidth={screenWidth} />
          </View>
        )}
      </ScrollView>

      {/* Componente AddTask con selezione categorie abilitata */}
      <AddTask 
        visible={showAddTask} 
        onClose={handleCloseAddTask}
        onSave={handleSaveTask}
        allowCategorySelection={true}
        categoryName="Calendario"
        initialDate={selectedDate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  calendarContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#ffffff",
  },
  selectedDateHeader: {
    marginTop: 35,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: "300",
    color: "#000000",
    fontFamily: "System",
    letterSpacing: -0.5,
  },
  syncIndicator: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
    fontFamily: 'System',
  },
  offlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginLeft: 4,
    fontFamily: 'System',
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    color: '#ffa726',
    marginLeft: 4,
    fontFamily: 'System',
  },
  taskList: {
    flex: 1,
    paddingHorizontal: 5,
  },
  noTasksContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 20,
  },
  noTasksText: {
    fontSize: 16,
    color: "#999999",
    marginTop: 15,
    marginBottom: 25,
    textAlign: "center",
    fontFamily: "System",
    fontWeight: "300",
  },
  addButton: {
    backgroundColor: "#000000",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addTaskButton: {
    backgroundColor: "#000000",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addTaskButtonText: {
    color: "#ffffff",
    fontWeight: "500",
    fontSize: 15,
    fontFamily: "System",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: "#666666",
    marginTop: 20,
    fontFamily: "System",
    fontWeight: "300",
    letterSpacing: -0.2,
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 15,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#000000",
    marginHorizontal: 3,
  },
});

export default CalendarView;