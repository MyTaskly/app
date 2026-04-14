import React from "react";
import { View, Pressable } from "react-native";
import { styles } from "./TaskStyles";
import { Checkbox, TaskTitle, DateDisplay, DaysRemaining, DurationDisplay } from "./BasicComponents";

// Componente per l'intestazione del task (checkbox, titolo, info)
const TaskHeader = ({
  task,
  isCompleted,
  expanded,
  onCheckboxPress,
  onTaskPress,
  onPressIn,
  onPressOut,
  isOptimistic = false,
  hideCheckbox = false
}) => {
  return (
    <View style={styles.topRow}>
      {/* Checkbox - Nascosto se hideCheckbox è true */}
      {!hideCheckbox && (
        <Checkbox
          checked={isCompleted}
          onPress={onCheckboxPress}
          isOptimistic={isOptimistic}
        />
      )}

      {/* Task Info */}
      <Pressable 
        style={styles.taskInfo} 
        onPress={onTaskPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        delayLongPress={500}
      >
        <TaskTitle 
          title={task.title} 
          completed={isCompleted}
          numberOfLines={expanded ? undefined : 1}
          priority={task.priority}
        />
      </Pressable>

      {/* Giorni rimanenti e durata (spostato a destra) */}
      <View style={styles.daysRemainingContainer}>
        <DaysRemaining
          endDate={task.end_time}
          isRecurring={task.is_recurring || task.is_generated_instance}
          nextOccurrence={task.next_occurrence}
        />
        <DurationDisplay durationMinutes={task.duration_minutes} />
      </View>
    </View>
  );
};

export default TaskHeader;
