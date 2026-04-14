import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/it';
import { RecurringTask, recurringTaskService } from '../../services/recurringTaskService';

interface RecurringTaskCardProps {
  task: RecurringTask;
  onUpdate: (updated: RecurringTask) => void;
  onPress?: (task: RecurringTask) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  Alta: '#FF3B30',
  Media: '#FF9500',
  Bassa: '#34C759',
};

const RecurringTaskCard: React.FC<RecurringTaskCardProps> = ({ task, onUpdate, onPress }) => {
  const [completing, setCompleting] = useState(false);

  const formatNextOccurrence = (iso: string | null): string => {
    if (!iso) return '—';
    const d = dayjs(iso);
    const now = dayjs();
    if (d.isSame(now, 'day')) return `Oggi ${d.format('HH:mm')}`;
    if (d.isSame(now.add(1, 'day'), 'day')) return `Domani ${d.format('HH:mm')}`;
    return d.format('DD/MM/YYYY HH:mm');
  };

  const getPatternLabel = (): string => {
    if (task.interval_minutes) {
      return `Ogni ${task.interval_minutes} min`;
    }
    if (!task.recurrence_pattern) return '';
    const labels: Record<string, string> = {
      daily: task.interval === 1 ? 'Ogni giorno' : `Ogni ${task.interval} giorni`,
      weekly: task.interval === 1 ? 'Ogni settimana' : `Ogni ${task.interval} settimane`,
      monthly: task.interval === 1 ? 'Ogni mese' : `Ogni ${task.interval} mesi`,
    };
    return labels[task.recurrence_pattern] ?? task.recurrence_pattern;
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const updated = await recurringTaskService.completeRecurringTask(task.id);
      onUpdate(updated);
    } catch (err: any) {
      Alert.alert('Errore', err?.response?.data?.detail || 'Impossibile completare il task');
    } finally {
      setCompleting(false);
    }
  };

  const isExhausted = !task.is_active && task.next_occurrence === null;

  return (
    <TouchableOpacity
      style={[styles.card, !task.is_active && styles.cardInactive]}
      onPress={() => onPress?.(task)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        {/* Priority dot */}
        <View
          style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] ?? '#aaa' }]}
        />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, !task.is_active && styles.titleInactive]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
            {task.google_calendar_event_id && (
              <Ionicons name="calendar" size={14} color="#5AC8FA" style={styles.calIcon} />
            )}
          </View>

          <Text style={styles.pattern}>{getPatternLabel()}</Text>

          {task.is_active ? (
            <View style={styles.nextRow}>
              <Ionicons name="time-outline" size={13} color="#888" />
              <Text style={styles.nextText}>{formatNextOccurrence(task.next_occurrence)}</Text>
            </View>
          ) : isExhausted ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Completato</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeInactive]}>
              <Text style={styles.badgeText}>Disattivato</Text>
            </View>
          )}
        </View>

        {task.is_active && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleComplete}
            disabled={completing}
          >
            {completing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={28} color="#007AFF" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardInactive: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '400',
    color: '#000000',
    letterSpacing: -0.3,
    flex: 1,
  },
  titleInactive: {
    color: '#888',
  },
  calIcon: {
    marginLeft: 4,
  },
  pattern: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  nextText: {
    fontSize: 12,
    color: '#555',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeInactive: {
    backgroundColor: '#8E8E93',
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  completeBtn: {
    marginLeft: 10,
    padding: 4,
  },
});

export default RecurringTaskCard;
