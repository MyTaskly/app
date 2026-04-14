import React, { useState, useRef, useEffect } from "react";
import { TouchableOpacity, Animated, Alert, LayoutAnimation, Platform, UIManager, Easing } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

// Importa i sottocomponenti
import TaskHeader from "./TaskHeader";
import TaskContent from "./TaskContent";
import TaskActionMenu from "./TaskActionMenu";
import TaskEditModal from "./TaskEditModal";
import ReadOnlyModal from "./ReadOnlyModal";

// Importa stili e utility
import { styles } from "./TaskStyles";
import { width, getPriorityColors, getPriorityBorderColor } from "./TaskUtils";

// Abilita LayoutAnimation per Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Componente principale per il task
const Task = ({
  task,
  onTaskComplete,
  onTaskDelete,
  onTaskEdit,
  onTaskUncomplete,
  isOwned = true,
  permissionLevel = "READ_WRITE",
  hideCheckbox = false,
}) => {
  // Stati
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReadOnlyModal, setShowReadOnlyModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Refs
  const animationInProgress = useRef(false);
  const longPressTimeoutRef = useRef(null);
  const descriptionRef = useRef(null);
  const componentRef = useRef(null);

  // Measurements
  const [descriptionHeight, setDescriptionHeight] = useState(0);
  const [componentHeight, setComponentHeight] = useState(0);
  
  // Animazioni
  const deleteAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const marginVerticalAnim = useRef(new Animated.Value(8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const containerHeightAnim = useRef(new Animated.Value(0)).current;

  // Determina se il task è completato
  const isCompleted = task.status === "Completato";
  // Ottieni il colore di priorità per lo sfondo e il bordo
  const priorityBackgroundColor = getPriorityColors(task.priority);
  const priorityBorderColor = getPriorityBorderColor(task.priority);
  const backgroundColor = isCompleted ? "#f8f8f8" : priorityBackgroundColor;

  // Effetti
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);
  
  // Gestori eventi
  const handlePressIn = () => {
    longPressTimeoutRef.current = setTimeout(() => {
      setShowModal(true);
    }, 500);
  };

  const handlePressOut = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const toggleExpand = () => {
    if (animationInProgress.current) return;
    
    // Non permettere l'espansione se non c'è descrizione
    if (!task.description || task.description.trim() === '') return;
    
    animationInProgress.current = true;
    const isExpanding = !expanded;

    LayoutAnimation.configureNext({
      duration: 300,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    
    setExpanded(isExpanding);
    
    if (isExpanding) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    }
    
    setTimeout(() => {
      animationInProgress.current = false;
    }, 350);
  };

  const onDescriptionLayout = (event) => {
    if (!descriptionHeight) {
      const height = event.nativeEvent.layout.height;
      setDescriptionHeight(Math.max(height, 20));
    }
  };

  const onComponentLayout = (event) => {
    if (componentHeight === 0) {
      const height = event.nativeEvent.layout.height;
      setComponentHeight(height);
      heightAnim.setValue(height);
      containerHeightAnim.setValue(height);
    }
  };

  const handleToggleComplete = async () => {
    try {
      if (isCompleted) {
        // Se il task è già completato, annulliamo il completamento
        if (onTaskUncomplete) {
          await onTaskUncomplete(task.id);
        } else {
          Alert.alert("Riaperto", `Task "${task.title}" riaperto.`);
        }
      } else {
        // Se il task non è completato, lo completiamo
        if (onTaskComplete) {
          await onTaskComplete(task.id);
        } else {
          Alert.alert("Completato", `Task "${task.title}" segnato come completato.`);
        }
      }
    } catch (error) {
      console.error("Errore durante la modifica dello stato del task:", error);
      Alert.alert("Errore", "Impossibile modificare lo stato del task. Riprova.");
    }
  };

  const handleEdit = () => {
    setShowModal(false);

    // Check if user has permission to edit
    if (!isOwned && permissionLevel === "READ_ONLY") {
      setShowReadOnlyModal(true);
      return;
    }

    setShowEditModal(true);
  };

  const handleSaveEdit = (editedTaskData) => {
    if (onTaskEdit) {
      const updatedTask = {
        ...task,
        title: editedTaskData.title,
        description: editedTaskData.description,
        start_time: editedTaskData.start_time,
        end_time: editedTaskData.end_time,
        priority: editedTaskData.priority,
        status: editedTaskData.status,
        duration_minutes: editedTaskData.duration_minutes,
        completed: editedTaskData.status === "Completato" ? true : task.completed,
        is_recurring: editedTaskData.is_recurring,
        recurrence_pattern: editedTaskData.recurrence_pattern,
        recurrence_interval: editedTaskData.recurrence_interval,
        recurrence_days_of_week: editedTaskData.recurrence_days_of_week,
        recurrence_day_of_month: editedTaskData.recurrence_day_of_month,
        recurrence_end_type: editedTaskData.recurrence_end_type,
        recurrence_end_date: editedTaskData.recurrence_end_date,
        recurrence_end_count: editedTaskData.recurrence_end_count,
      };

      const hasChanged =
        task.title !== updatedTask.title ||
        task.description !== updatedTask.description ||
        task.start_time !== updatedTask.start_time ||
        task.end_time !== updatedTask.end_time ||
        task.priority !== updatedTask.priority ||
        task.status !== updatedTask.status ||
        task.completed !== updatedTask.completed ||
        task.duration_minutes !== updatedTask.duration_minutes ||
        task.is_recurring !== updatedTask.is_recurring ||
        task.recurrence_pattern !== updatedTask.recurrence_pattern ||
        task.recurrence_interval !== updatedTask.recurrence_interval;
      
      if (hasChanged) {
        console.log("Salvataggio modifiche per task:", updatedTask);
        onTaskEdit(task.id, updatedTask);
      } else {
        console.log("Nessuna modifica rilevata");
      }
      
      setShowEditModal(false);
    } else {
      Alert.alert("Modifica", `Modifiche salvate per "${editedTaskData.title}"`);
      setShowEditModal(false);
    }
  };

  const animateTaskRemoval = () => {
    setIsRemoving(true);
    
    Animated.sequence([
      Animated.sequence([
        Animated.timing(translateXAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(translateXAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(translateXAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(translateXAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      
      Animated.timing(translateXAnim, {
        toValue: width,
        duration: 300,
        useNativeDriver: true,
      }),
      
      Animated.timing(deleteAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(containerHeightAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
          easing: Easing.out(Easing.cubic)
        }),
        Animated.timing(marginVerticalAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
          easing: Easing.out(Easing.cubic)
        }),
      ]).start(() => {
        if (onTaskDelete) {
          console.log("Eliminazione dell'impegno con ID:", task.id);
          onTaskDelete(task.id);
        }
      });
    });
  };

  const handleDelete = () => {
    // Check if user has permission to delete
    if (!isOwned && permissionLevel === "READ_ONLY") {
      setShowModal(false);
      setShowReadOnlyModal(true);
      return;
    }

    setIsDeleting(true);
    Alert.alert(
      "Elimina Task",
      `Sei sicuro di voler eliminare "${task.title}"?`,
      [
        {
          text: "Annulla",
          style: "cancel",
          onPress: () => {
            setIsDeleting(false);
            setShowModal(false);
          }
        },
        {
          text: "Elimina",
          style: "destructive",
          onPress: () => {
            setShowModal(false);
            animateTaskRemoval();
            setIsDeleting(false);
          }
        },
      ]
    );
  };

  const handleShare = () => {
    setShowModal(false);
    Alert.alert("Condivisione", "Funzionalità di condivisione non ancora implementata");
  };

  const handleReopen = async () => {
    try {
      // Riapri il task completato
      if (onTaskUncomplete) {
        await onTaskUncomplete(task.id);
      } else {
        Alert.alert("Riaperto", `Task "${task.title}" riaperto.`);
      }
    } catch (error) {
      console.error("Errore durante la riapertura del task:", error);
      Alert.alert("Errore", "Impossibile riaprire il task. Riprova.");
    }
  };

  return (
    <Animated.View 
      style={[
        {
          marginVertical: marginVerticalAnim,
          height: isRemoving ? containerHeightAnim : undefined,
          overflow: 'hidden'
        }
      ]}
      ref={componentRef}
      onLayout={onComponentLayout}
    >
      <Animated.View
        style={[
          styles.card,
          { 
            backgroundColor,
            borderLeftWidth: 4,
            borderLeftColor: isCompleted ? "#cccccc" : priorityBorderColor
          },
          {
            opacity: deleteAnim,
            transform: [
              { translateX: translateXAnim },
              { scale: deleteAnim }
            ],
          }
        ]}
      >
        {/* Header con checkbox, titolo e data */}
        <TaskHeader
          task={task}
          isCompleted={isCompleted}
          expanded={expanded}
          onCheckboxPress={handleToggleComplete}
          onTaskPress={toggleExpand}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          isOptimistic={task.isOptimistic || false}
          hideCheckbox={hideCheckbox}
        />

        {/* Area descrizione espandibile */}
        <TaskContent 
          description={task.description}
          expanded={expanded}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
          onLayout={onDescriptionLayout}
          descriptionRef={descriptionRef}
        />

        {/* Modal menu azioni */}
        <TaskActionMenu 
          visible={showModal}
          onClose={() => setShowModal(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onShare={handleShare}
          isDeleting={isDeleting}
          isCompleted={isCompleted}
          onReopen={handleReopen}
        />

        {/* Modal modifica task */}
        <TaskEditModal
          visible={showEditModal}
          task={task}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
        />

        {/* Modal sola lettura */}
        <ReadOnlyModal
          visible={showReadOnlyModal}
          onClose={() => setShowReadOnlyModal(false)}
          taskTitle={task.title}
        />
      </Animated.View>
    </Animated.View>
  );
};

export default Task;
