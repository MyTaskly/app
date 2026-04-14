import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styles } from './styles';
import { Task as TaskType, globalTasksRef } from './types';
import { TaskListHeader } from './TaskListHeader';
import eventEmitter, { EVENTS } from '../../utils/eventEmitter';
import { ActiveFilters } from './ActiveFilters';
import { FilterModal } from './FilterModal';
import { TaskSection } from './TaskSection';
import { AddTaskButton } from './AddTaskButton';
import { filterTasksByDay } from './TaskUtils';
import AddTask from '../Task/AddTask';

export interface TaskListContainerProps {
  categoryName: string;
  categoryId: string;
  isOwned?: boolean;
  permissionLevel?: "READ_ONLY" | "READ_WRITE";
  Task: React.ComponentType<any>; // Componente Task
  taskService: {
    getTasks: (categoryId: string) => Promise<TaskType[]>;
    addTask: (task: any) => Promise<any>;
    deleteTask: (taskId: number | string) => Promise<void>;
    updateTask: (taskId: number | string, task: any) => Promise<any>;
    completeTask: (taskId: number | string) => Promise<void>;
    disCompleteTask: (taskId: number | string) => Promise<void>;
  };
}

export const TaskListContainer = ({
  categoryName,
  categoryId,
  isOwned = true,
  permissionLevel = "READ_WRITE",
  Task,
  taskService
}: TaskListContainerProps) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [filtroImportanza, setFiltroImportanza] = useState("Tutte");
  const [filtroScadenza, setFiltroScadenza] = useState("Tutte");
  const [ordineScadenza, setOrdineScadenza] = useState("Recente");
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  
  // Stati per le sezioni collassabili
  const [todoSectionExpanded, setTodoSectionExpanded] = useState(true);
  const [completedSectionExpanded, setCompletedSectionExpanded] = useState(true);
  
  // Animated values per le animazioni di altezza
  const todoSectionHeight = useRef(new Animated.Value(1)).current;
  const completedSectionHeight = useRef(new Animated.Value(1)).current;

  // Initialize the global task adder function
  globalTasksRef.addTask = (newTask: TaskType, category: string) => {
    // Verify that it's a valid task with title
    if (!newTask || !newTask.title) {
      return;
    }
    
    // Ensure it has an ID - use task_id if available (from server response)
    const taskWithId = {
      ...newTask,
      id: newTask.id || newTask.task_id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Update the local state directly if this is the current category
    if (category === categoryId) {
      setTasks(prevTasks => {
        // Check if task already exists by ID only
        const taskIndex = prevTasks.findIndex(
          task => (task.id && task.id === taskWithId.id) ||
                 (task.task_id && taskWithId.task_id && task.task_id === taskWithId.task_id)
        );

        if (taskIndex >= 0) {
          // Update existing task
          const updatedTasks = [...prevTasks];
          updatedTasks[taskIndex] = taskWithId;
          return updatedTasks;
        }

        // Add new task
        return [...prevTasks, taskWithId];
      });
    }
    
    // Always update the global reference
    if (!globalTasksRef.tasks[category]) {
      globalTasksRef.tasks[category] = [];
    }
    
    // Check if task already exists in global ref by ID only
    const globalTaskIndex = globalTasksRef.tasks[category].findIndex(
      task => (task.id && task.id === taskWithId.id) ||
             (task.task_id && taskWithId.task_id && task.task_id === taskWithId.task_id)
    );

    if (globalTaskIndex >= 0) {
      // Update existing task
      globalTasksRef.tasks[category][globalTaskIndex] = taskWithId;
    } else {
      // Add new task
      globalTasksRef.tasks[category].push(taskWithId);
    }
  };

  const fetchTasks = useCallback(async () => {
    try {
      const data = await taskService.getTasks(categoryId);

      // IMPORTANTE: Normalizza i task per assicurarsi che abbiano sempre un id valido
      const normalizedTasks = data.map(task => ({
        ...task,
        id: task.id || task.task_id,  // Assicura che id sia sempre presente
        task_id: Number(task.task_id || task.id)  // Assicura che task_id sia sempre presente come numero
      }));

      setTasks(normalizedTasks);

      // Update global reference
      globalTasksRef.tasks[categoryName] = normalizedTasks;
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setIsLoading(false);
    }
  }, [categoryId, categoryName, taskService]);

  useEffect(() => {
    fetchTasks();
  }, [categoryId, fetchTasks]);

  // Update global reference when tasks state changes
  useEffect(() => {
    globalTasksRef.tasks[categoryName] = tasks;
  }, [tasks, categoryName]);

  // Setup listeners per aggiornamenti task in tempo reale
  useEffect(() => {
    const handleTaskAdded = (newTask: TaskType) => {
      // Solo aggiorna se il task appartiene a questa categoria (usa category_id se disponibile)
      const taskBelongsToCategory =
        (newTask.category_id && newTask.category_id.toString() === categoryId.toString()) ||
        newTask.category_name === categoryName ||
        newTask.category_name === categoryId;

      if (taskBelongsToCategory) {
        console.log('[TASK_LIST_CONTAINER] Task added event received for category:', categoryName, newTask.title);

        // Normalizza il nuovo task
        const normalizedTask = {
          ...newTask,
          id: newTask.id || newTask.task_id,
          task_id: Number(newTask.task_id || newTask.id)
        };

        setTasks(prevTasks => {
          // Evita duplicati
          const taskId = normalizedTask.task_id || normalizedTask.id;
          if (taskId && prevTasks.some(task =>
            (task.id === taskId) || (task.task_id === taskId)
          )) {
            return prevTasks;
          }
          return [...prevTasks, normalizedTask];
        });
      }
    };

    const handleTaskUpdated = (updatedTask: TaskType) => {
      console.log('[TASK_LIST_CONTAINER] Task updated event received for category:', categoryName);

      // Normalizza il task aggiornato
      const normalizedUpdatedTask = {
        ...updatedTask,
        id: updatedTask.id || updatedTask.task_id,
        task_id: Number(updatedTask.task_id || updatedTask.id)
      };

      console.log('[TASK_LIST_CONTAINER] Updated task:', {
        title: normalizedUpdatedTask.title,
        id: normalizedUpdatedTask.id,
        task_id: normalizedUpdatedTask.task_id,
        status: normalizedUpdatedTask.status,
        category: normalizedUpdatedTask.category_name
      });

      setTasks(prevTasks => {
        console.log(`[TASK_LIST_CONTAINER] Stato precedente: ${prevTasks.length} task`);
        prevTasks.forEach((t, i) => {
          console.log(`[TASK_LIST_CONTAINER] Task ${i+1}: "${t.title}" (id:${t.id}, task_id:${t.task_id}, status:${t.status})`);
        });

        const updatedTaskId = normalizedUpdatedTask.task_id || normalizedUpdatedTask.id;

        let foundMatch = false;
        const newTasks = prevTasks.map(task => {
          // Match solo se abbiamo un ID valido e corrisponde
          const taskId = task.task_id || task.id;
          const isMatch = updatedTaskId && taskId && taskId === updatedTaskId;

          if (isMatch) {
            foundMatch = true;
            console.log(`[TASK_LIST_CONTAINER] ✅ Match trovato: "${task.title}" -> aggiornato a status "${normalizedUpdatedTask.status}"`);

            // Merge preservando id e task_id dal task originale se mancanti nell'update
            return {
              ...task,
              ...normalizedUpdatedTask,
              id: normalizedUpdatedTask.id || task.id,
              task_id: normalizedUpdatedTask.task_id || task.task_id
            };
          }
          return task;
        });

        if (!foundMatch) {
          console.log('[TASK_LIST_CONTAINER] ⚠️ Nessun match trovato per il task aggiornato!');
        }

        console.log(`[TASK_LIST_CONTAINER] Nuovo stato: ${newTasks.length} task`);
        newTasks.forEach((t, i) => {
          console.log(`[TASK_LIST_CONTAINER] Nuovo Task ${i+1}: "${t.title}" (id:${t.id}, task_id:${t.task_id}, status:${t.status})`);
        });

        // Se il task è stato spostato fuori da questa categoria, rimuovilo
        if (normalizedUpdatedTask.category_name &&
            normalizedUpdatedTask.category_name !== categoryName &&
            normalizedUpdatedTask.category_name !== categoryId) {
          console.log('[TASK_LIST_CONTAINER] Task spostato fuori dalla categoria, rimozione...');
          const taskIdToRemove = normalizedUpdatedTask.task_id || normalizedUpdatedTask.id;
          return newTasks.filter(task => {
            const currentTaskId = task.task_id || task.id;
            return currentTaskId !== taskIdToRemove;
          });
        }

        return newTasks;
      });
    };

    const handleTaskDeleted = (taskId: string | number) => {
      console.log('[TASK_LIST_CONTAINER] Task deleted event received for category:', categoryName, taskId);
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
  }, [categoryName, categoryId]);

  // Separiamo i task in completati e non completati
  const completedTasks = useMemo(() => {
    return tasks.filter(task => task.status === "Completato");
  }, [tasks]);
  
  const incompleteTasks = useMemo(() => {
    return tasks.filter(task => task.status !== "Completato");
  }, [tasks]);

  // Funzione per applicare i filtri e ordinare solo sui task non completati
  const listaFiltrata = useMemo(() => {
    // Prima filtra per importanza
    let filteredTasks = incompleteTasks.filter((task) => {
      const matchesImportanza =
        filtroImportanza === "Tutte" ||
        (filtroImportanza === "Alta" && task.priority === "Alta") ||
        (filtroImportanza === "Media" && task.priority === "Media") ||
        (filtroImportanza === "Bassa" && task.priority === "Bassa");
      
      return matchesImportanza;
    });
    
    // Poi applica il filtro per data
    if (filtroScadenza !== "Tutte") {
      filteredTasks = filterTasksByDay(filteredTasks, filtroScadenza);
    }
    
    // Infine ordina
    return filteredTasks.sort((a, b) => {
      // I task senza scadenza vanno sempre in fondo
      if (!a.end_time && !b.end_time) return 0;
      if (!a.end_time) return 1;
      if (!b.end_time) return -1;
      
      if (ordineScadenza === "Recente") {
        return new Date(b.end_time).getTime() - new Date(a.end_time).getTime();
      } else {
        return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
      }
    });
  }, [incompleteTasks, filtroImportanza, filtroScadenza, ordineScadenza]);

  const handleAddTask = async (
    title: string,
    description: string,
    dueDate: string,
    priority: number,
    categoryName?: string,
    recurrence?: any,
    durationMinutes?: number | null
  ) => {
    const priorityString = priority === 1 ? "Bassa" : priority === 2 ? "Media" : "Alta";

    try {
      const taskData: any = {
        title,
        description: description || "",
        start_time: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
        end_time: dueDate ? new Date(dueDate).toISOString() : undefined,
        priority: priorityString,
        category_id: parseInt(categoryId as string) || 0,
        category_name: categoryName,
        status: "In sospeso",
      };

      // Add duration_minutes if provided (API v2.1.0)
      if (durationMinutes !== undefined && durationMinutes !== null) {
        taskData.duration_minutes = durationMinutes;
      }

      // Add recurring task fields if this is a recurring task (NEW API v2.2.0)
      if (recurrence) {
        taskData.is_recurring = true;
        taskData.recurrence_pattern = recurrence.pattern;
        taskData.recurrence_interval = recurrence.interval || 1;
        taskData.recurrence_end_type = recurrence.end_type || "never";

        // Add pattern-specific fields
        if (recurrence.pattern === "weekly" && recurrence.days_of_week) {
          taskData.recurrence_days_of_week = recurrence.days_of_week;
        }
        if (recurrence.pattern === "monthly" && recurrence.day_of_month) {
          taskData.recurrence_day_of_month = recurrence.day_of_month;
        }

        // Add end-type-specific fields
        if (recurrence.end_type === "on_date" && recurrence.end_date) {
          taskData.recurrence_end_date = recurrence.end_date;
        }
        if (recurrence.end_type === "after_count" && recurrence.end_count) {
          taskData.recurrence_end_count = recurrence.end_count;
        }
      }

      // Use the standard addTask service (works for both regular and recurring tasks)
      const result = await taskService.addTask(taskData);

      if (result) {
        // Reload tasks to show the new task
        fetchTasks();
      }
    } catch (error) {
      console.error("Error creating task:", error);
      Alert.alert(
        t('error') || "Error",
        t('recurring.taskError') || "An error occurred while creating the task"
      );
    }
  };

  // Funzione per gestire l'eliminazione del task
  const handleTaskDelete = async (taskId: number | string) => {
    try {
      // Aggiorniamo subito la lista locale per un feedback immediato
      setTasks(prevTasks => prevTasks.filter(task =>
        task.id !== taskId && task.task_id !== taskId
      ));

      // Aggiorniamo anche la referenza globale
      if (globalTasksRef.tasks[categoryName]) {
        globalTasksRef.tasks[categoryName] = globalTasksRef.tasks[categoryName].filter(
          task => task.id !== taskId && task.task_id !== taskId
        );
      }

      // Inviamo la richiesta di eliminazione al server in background
      await taskService.deleteTask(taskId);
    } catch (error) {
      console.error("Errore nell'eliminazione del task:", error);
      // Informiamo l'utente dell'errore ma non ripristiniamo il task
      Alert.alert(
        "Avviso",
        "Il task è stato rimosso localmente, ma c'è stato un errore durante l'eliminazione dal server."
      );
    }
  };

  // Funzione per gestire la modifica del task
  const handleTaskEdit = async (taskId: number | string, updatedTaskData: TaskType) => {
    try {
      // Prepara il task aggiornato mantenendo l'ID originale
      const taskToUpdate = {
        ...updatedTaskData,
        id: taskId
      };
      
      // Usa lo stesso meccanismo di addTask per aggiornare il task localmente
      globalTasksRef.addTask(taskToUpdate, categoryName);
      
      // Inviamo la richiesta di aggiornamento al server
      const response = await taskService.updateTask(taskId, updatedTaskData);
      
      // Se la risposta contiene dati aggiornati dal server, aggiorniamo lo stato con quei dati
      if (response && response.task_id) {
        const serverUpdatedTask = {
          ...response,
          id: taskId  // Mantieni l'ID originale per coerenza
        };
        
        // Aggiorna nuovamente con i dati del server
        globalTasksRef.addTask(serverUpdatedTask, categoryName);
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento del task:", error);
      
      // Mostra un avviso all'utente
      Alert.alert(
        "Errore di aggiornamento",
        "Si è verificato un problema durante l'aggiornamento del task. I dati potrebbero non essere sincronizzati con il server.",
        [{ text: "OK" }]
      );
      
      // Ricarica i dati dal server per mantenere la coerenza
      fetchTasks();
    }
  };

  // Funzione per aprire il form di aggiunta task
  const toggleForm = () => {
    setFormVisible(true);
  };

  // Funzione per chiudere il form di aggiunta task
  const handleCloseForm = () => {
    setFormVisible(false);
  };

  // Gestisce il toggle del completamento dei task
  const handleTaskComplete = async (taskId: number | string) => {
    try {
      await taskService.completeTask(taskId);
      // L'aggiornamento dello stato avverrà tramite l'evento TASK_UPDATED emesso dal servizio
    } catch (error) {
      console.error("Errore durante il completamento del task:", error);
      Alert.alert("Errore", "Impossibile completare il task. Riprova.");
    }
  };

  // Gestisce il ripristino di un task completato
  const handleTaskUncomplete = async (taskId: number | string) => {
    try {
      await taskService.disCompleteTask(taskId);
      // L'aggiornamento dello stato avverrà tramite l'evento TASK_UPDATED emesso dal servizio
    } catch (error) {
      console.error("Errore durante la riapertura del task:", error);
      Alert.alert("Errore", "Impossibile riaprire il task. Riprova.");
    }
  };

  // Funzione di animazione per le sezioni
  const toggleSection = (isExpanded: boolean, setExpanded: React.Dispatch<React.SetStateAction<boolean>>, heightValue: Animated.Value) => {
    setExpanded(!isExpanded);
    Animated.timing(heightValue, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false
    }).start();
  };

  return (
    <View style={styles.container}>
      <TaskListHeader 
        title={categoryName}
        onFilterPress={() => setModalVisible(true)}
      />

      {isLoading ? (
        <ActivityIndicator size="large" color="#10e0e0" />
      ) : (
        <ScrollView style={styles.scrollContainer}>
          {/* Modal dei filtri */}
          <FilterModal 
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            filtroImportanza={filtroImportanza}
            setFiltroImportanza={setFiltroImportanza}
            filtroScadenza={filtroScadenza}
            setFiltroScadenza={setFiltroScadenza}
            ordineScadenza={ordineScadenza}
            setOrdineScadenza={setOrdineScadenza}
          />

          {/* Visualizzazione filtri attivi */}
          <ActiveFilters 
            importanceFilter={filtroImportanza}
            deadlineFilter={filtroScadenza}
            onClearImportanceFilter={() => setFiltroImportanza("Tutte")}
            onClearDeadlineFilter={() => setFiltroScadenza("Tutte")}
          />

          {/* Sezione task non completati */}
          <TaskSection
            title={t('taskList.sections.todo')}
            isExpanded={todoSectionExpanded}
            tasks={listaFiltrata}
            animatedHeight={todoSectionHeight}
            onToggle={() => toggleSection(todoSectionExpanded, setTodoSectionExpanded, todoSectionHeight)}
            renderTask={(item, index) => {
              // Ensure every task has a valid ID
              const taskId = item.id || item.task_id || `fallback_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
              return (
                <Task
                  key={`task-${taskId}`}
                  task={{
                    ...item,
                    id: taskId,
                    start_time: item.start_time || new Date().toISOString(),
                    status: item.status || "In sospeso",
                    completed: item.completed || false
                  }}
                  onTaskComplete={handleTaskComplete}
                  onTaskDelete={handleTaskDelete}
                  onTaskEdit={handleTaskEdit}
                  onTaskUncomplete={handleTaskUncomplete}
                  isOwned={isOwned}
                  permissionLevel={permissionLevel}
                />
              );
            }}
            emptyMessage={t('taskList.sections.emptyTodo')}
          />

          {/* Sezione task completati */}
          {completedTasks.length > 0 && (
            <TaskSection
              title={t('taskList.sections.completed')}
              isExpanded={completedSectionExpanded}
              tasks={completedTasks}
              animatedHeight={completedSectionHeight}
              onToggle={() => toggleSection(completedSectionExpanded, setCompletedSectionExpanded, completedSectionHeight)}
              renderTask={(item, index) => {
                // Ensure every completed task has a valid ID
                const taskId = item.id || item.task_id || `completed_fallback_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
                return (
                  <Task
                    key={`completed-task-${taskId}`}
                    task={{
                      ...item,
                      id: taskId,
                      start_time: item.start_time || new Date().toISOString(),
                      status: "Completato",
                      completed: true
                    }}
                    onTaskDelete={handleTaskDelete}
                    onTaskEdit={handleTaskEdit}
                    onTaskUncomplete={handleTaskUncomplete}
                    isOwned={isOwned}
                    permissionLevel={permissionLevel}
                  />
                );
              }}
              emptyMessage={t('taskList.sections.emptyCompleted')}
            />
          )}

          {/* Spazio per il pulsante flottante */}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
      
      <AddTaskButton onPress={toggleForm} />
      
      <AddTask 
        visible={formVisible} 
        onClose={handleCloseForm} 
        onSave={handleAddTask}
        categoryName={categoryName}
      />
    </View>
  );
};
