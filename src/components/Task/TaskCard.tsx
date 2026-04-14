import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Task } from '../../services/taskService';

export interface TaskCardProps {
  task: Task;
  onPress?: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  
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

  const formatTaskTime = (startTime?: string, endTime?: string, nextOccurrence?: string): string => {
    // For recurring tasks, show next occurrence instead of end_time
    const dateToShow = nextOccurrence || endTime || startTime;

    if (!dateToShow) {
      return 'Nessuna scadenza';
    }

    const now = dayjs();
    const taskDate = dayjs(dateToShow);

    let datePrefix = '';
    if (taskDate.isSame(now, 'day')) {
      datePrefix = 'Oggi ';
    } else if (taskDate.isSame(now.add(1, 'day'), 'day')) {
      datePrefix = 'Domani ';
    } else {
      datePrefix = taskDate.format('DD/MM ');
    }

    const timeRange = dayjs(dateToShow).format('HH:mm');

    return datePrefix + timeRange;
  };

  // Calcola la prossima data di scadenza stimata dal pattern di ricorrenza
  const computeNextOccurrence = (): string | null => {
    const pattern = task.recurrence_pattern;
    if (!pattern) return null;

    const interval = task.recurrence_interval || 1;
    const now = dayjs();

    if (pattern === 'daily') {
      return now.add(interval, 'day').hour(9).minute(0).second(0).toISOString();
    }

    if (pattern === 'weekly') {
      const days = task.recurrence_days_of_week;
      if (days && days.length > 0) {
        // Trova il prossimo giorno della settimana corrispondente (1=Lun, 7=Dom)
        // dayjs: 0=Dom, 1=Lun, ..., 6=Sab → converti
        const todayDow = now.day() === 0 ? 7 : now.day(); // 1-7 Mon-Sun
        const sortedDays = [...days].sort((a, b) => a - b);
        const nextDay = sortedDays.find(d => d > todayDow) ?? sortedDays[0];
        const daysUntil = nextDay > todayDow
          ? nextDay - todayDow
          : 7 - todayDow + nextDay;
        return now.add(daysUntil, 'day').hour(9).minute(0).second(0).toISOString();
      }
      return now.add(interval * 7, 'day').hour(9).minute(0).second(0).toISOString();
    }

    if (pattern === 'monthly') {
      const dayOfMonth = task.recurrence_day_of_month || 1;
      let next = now.date(dayOfMonth).hour(9).minute(0).second(0);
      if (next.isBefore(now) || next.isSame(now, 'day')) {
        next = next.add(interval, 'month');
      }
      return next.toISOString();
    }

    return null;
  };

  // Format recurrence description for display
  const getRecurrenceDescription = (): string | null => {
    if (!task.is_recurring || !task.recurrence_pattern) return null;

    const interval = task.recurrence_interval || 1;

    if (task.recurrence_pattern === 'daily') {
      return interval === 1 ? 'Ogni giorno' : `Ogni ${interval} giorni`;
    }

    if (task.recurrence_pattern === 'weekly') {
      const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
      if (task.recurrence_days_of_week && task.recurrence_days_of_week.length > 0) {
        const days = task.recurrence_days_of_week.map(d => dayNames[d - 1]).join(', ');
        return interval === 1 ? `Ogni ${days}` : `Ogni ${interval} settimane: ${days}`;
      }
      return interval === 1 ? 'Ogni settimana' : `Ogni ${interval} settimane`;
    }

    if (task.recurrence_pattern === 'monthly') {
      const day = task.recurrence_day_of_month || 1;
      return interval === 1
        ? `Ogni ${day}° giorno del mese`
        : `Ogni ${interval} mesi il ${day}°`;
    }

    return 'Ricorrente';
  };

  // Format duration for display
  const formatDuration = (minutes?: number | null): string | null => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return hours === 1 ? '1 ora' : `${hours} ore`;
    }
    return `${hours}h ${remainingMinutes}min`;
  };

  // Determina il colore in base alla priorità (gradiente di scurezza)
  const priorityColors: Record<string, string> = {
    'Alta': '#000000',     // Nero per alta priorità
    'Media': '#333333',    // Grigio scuro per media priorità
    'Bassa': '#666666',    // Grigio medio per bassa priorità
    'default': '#999999'   // Grigio chiaro per default
  };
  
  const cardColor = task.priority ? 
    priorityColors[task.priority] || priorityColors.default : 
    priorityColors.default;
    
  return (
    <TouchableOpacity
      style={[styles.taskCard, { borderLeftColor: cardColor, borderLeftWidth: 5 }]}
      onPress={() => onPress && onPress(task)}
    >
      <View style={styles.taskCardContent}>
        <View style={styles.titleRow}>
          <Text style={styles.taskTitle} numberOfLines={1} ellipsizeMode="tail">
            {sanitizeString(task.title)}
          </Text>
          {(task.is_recurring || task.is_generated_instance) && (
            <View style={styles.recurringBadge}>
              <Ionicons name="repeat" size={14} color="#007AFF" />
            </View>
          )}
        </View>

        {(() => {
          const description = sanitizeString(task.description);
          return description && description !== 'null' && description !== '' ? (
            <Text style={styles.taskDescription} numberOfLines={2} ellipsizeMode="tail">
              {description}
            </Text>
          ) : null;
        })()}

        {/* Show recurrence pattern for recurring tasks */}
        {task.is_recurring && getRecurrenceDescription() && (
          <Text style={styles.recurrenceDescription}>
            {getRecurrenceDescription()}
          </Text>
        )}

        {/* Show completion count for recurring tasks */}
        {task.is_recurring && task.recurrence_current_count !== undefined && task.recurrence_current_count > 0 && (
          <Text style={styles.completionCount}>
            Completato {task.recurrence_current_count} {task.recurrence_current_count === 1 ? 'volta' : 'volte'}
          </Text>
        )}
        
        <View style={styles.taskMetadata}>
          {(() => {
            const categoryName = sanitizeString(task.category_name);
            return categoryName && categoryName !== 'null' && categoryName !== '' ? (
              <View style={styles.taskCategory}>
                <Text style={styles.taskCategoryText}>
                  {categoryName}
                </Text>
              </View>
            ) : null;
          })()}
          
          <View style={styles.taskStatus}>
            <Text style={[
              styles.taskStatusText, 
              { color: task.status === 'Completato' ? '#000000' : '#666666' }
            ]}>
              {sanitizeString(task.status)}
            </Text>
          </View>
        </View>

        {/* Duration display */}
        {formatDuration(task.duration_minutes) && (
          <View style={styles.durationInfo}>
            <Text style={styles.durationInfoText}>
              {formatDuration(task.duration_minutes)}
            </Text>
          </View>
        )}

        {/* Date / next occurrence */}
        {(() => {
          const isRecurring = task.is_recurring || task.is_generated_instance;
          if (isRecurring) {
            const dateString = task.next_occurrence || task.end_time || computeNextOccurrence();
            const label = dateString
              ? formatTaskTime(undefined, dateString, undefined)
              : 'Ricorrente';
            return (
              <View style={styles.dateRow}>
                <Ionicons name="time-outline" size={13} color="#007AFF" />
                <Text style={[styles.dateRowText, styles.dateRowRecurring]}>{label}</Text>
              </View>
            );
          }
          const dateString = task.end_time;
          const label = dateString
            ? formatTaskTime(task.start_time, task.end_time)
            : 'Nessuna scadenza';
          return (
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={13} color="#999999" />
              <Text style={[styles.dateRowText, styles.dateRowNone]}>{label}</Text>
            </View>
          );
        })()}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  taskCardContent: {
    flexDirection: "column",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    fontFamily: "System",
    letterSpacing: -0.3,
    flex: 1,
  },
  recurringBadge: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  taskDescription: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
    lineHeight: 20,
    fontFamily: "System",
    fontWeight: "300",
  },
  taskMetadata: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  taskCategory: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  taskCategoryText: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "400",
    fontFamily: "System",
  },
  taskStatus: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  taskStatusText: {
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "System",
  },
  recurrenceDescription: {
    fontSize: 12,
    color: "#007AFF",
    marginBottom: 6,
    fontFamily: "System",
    fontWeight: "400",
  },
  completionCount: {
    fontSize: 11,
    color: "#666666",
    marginBottom: 6,
    fontFamily: "System",
    fontWeight: "300",
    fontStyle: "italic",
  },
  durationInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  durationInfoText: {
    fontSize: 12,
    color: "#666666",
    marginLeft: 6,
    fontFamily: "System",
    fontWeight: "400",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  dateRowText: {
    fontSize: 12,
    fontFamily: "System",
    fontWeight: "400",
  },
  dateRowRecurring: {
    color: "#007AFF",
  },
  dateRowNone: {
    color: "#999999",
  },
});

export default TaskCard;