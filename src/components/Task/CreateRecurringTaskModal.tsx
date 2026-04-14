import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import dayjs from 'dayjs';
import { getCategories } from '../../services/taskService';
import {
  recurringTaskService,
  RecurringTask,
  CreateRecurringTaskPayload,
  UpdateRecurringTaskPayload,
  Priority,
  RecurrencePattern,
  EndType,
} from '../../services/recurringTaskService';

// ── Types ──────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  name: string;
}

interface Props {
  visible: boolean;
  taskId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

type RecurrenceMode = 'interval' | 'pattern';

const DAYS_OF_WEEK = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'M', value: 3 },
  { label: 'G', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 7 },
];

const PRIORITIES: Priority[] = ['Bassa', 'Media', 'Alta'];

const nextFullHour = (): Date => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};

// ── Component ──────────────────────────────────────────────────────────────

const CreateRecurringTaskModal: React.FC<Props> = ({ visible, taskId, onClose, onSaved }) => {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState<Date>(nextFullHour());
  const [priority, setPriority] = useState<Priority>('Media');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('pattern');
  const [intervalMinutes, setIntervalMinutes] = useState('');
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [interval, setInterval] = useState('1');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endType, setEndType] = useState<EndType>('never');
  const [endCount, setEndCount] = useState('');
  const [endDate, setEndDate] = useState<Date | null>(null);

  // UI state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTask, setLoadingTask] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [daysError, setDaysError] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const isEditMode = taskId !== null;

  // Load categories and existing task on open
  useEffect(() => {
    if (!visible) return;

    getCategories().then((cats: any[]) => setCategories(cats));

    if (isEditMode && taskId !== null) {
      loadExistingTask(taskId);
    } else {
      resetForm();
    }
  }, [visible, taskId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime(nextFullHour());
    setPriority('Media');
    setCategoryId(null);
    setRecurrenceMode('pattern');
    setIntervalMinutes('');
    setRecurrencePattern('daily');
    setInterval('1');
    setDaysOfWeek([]);
    setEndType('never');
    setEndCount('');
    setEndDate(null);
    setTitleError('');
    setDaysError('');
  };

  const loadExistingTask = async (id: number) => {
    setLoadingTask(true);
    try {
      const task: RecurringTask = await recurringTaskService.getRecurringTask(id);
      setTitle(task.title);
      setDescription(task.description ?? '');
      setStartTime(new Date(task.start_time));
      setPriority(task.priority);
      setCategoryId(task.category_id);
      setEndType(task.end_type);
      setEndCount(task.end_count !== null ? String(task.end_count) : '');
      setEndDate(task.end_date ? new Date(task.end_date) : null);
      setInterval(String(task.interval));

      if (task.interval_minutes) {
        setRecurrenceMode('interval');
        setIntervalMinutes(String(task.interval_minutes));
      } else {
        setRecurrenceMode('pattern');
        setRecurrencePattern(task.recurrence_pattern ?? 'daily');
        setDaysOfWeek(task.days_of_week ?? []);
      }
    } catch (err: any) {
      Alert.alert('Errore', 'Impossibile caricare il task');
    } finally {
      setLoadingTask(false);
    }
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
    setDaysError('');
  };

  const validate = (): boolean => {
    let valid = true;
    if (!title.trim()) {
      setTitleError('Il titolo è obbligatorio');
      valid = false;
    } else {
      setTitleError('');
    }
    if (recurrenceMode === 'pattern' && recurrencePattern === 'weekly' && daysOfWeek.length === 0) {
      setDaysError('Seleziona almeno un giorno');
      valid = false;
    } else {
      setDaysError('');
    }
    if (endType === 'after_count' && (!endCount || Number(endCount) < 1)) {
      Alert.alert('Errore', 'Inserisci un numero di occorrenze valido (min 1)');
      valid = false;
    }
    if (endType === 'on_date' && !endDate) {
      Alert.alert('Errore', 'Seleziona una data di fine');
      valid = false;
    }
    return valid;
  };

  const buildPayload = (): CreateRecurringTaskPayload => {
    const base: CreateRecurringTaskPayload = {
      title: title.trim(),
      description: description.trim() || null,
      start_time: startTime.toISOString(),
      priority,
      category_id: categoryId,
      end_type: endType,
      end_count: endType === 'after_count' ? Number(endCount) : null,
      end_date: endType === 'on_date' && endDate ? endDate.toISOString() : null,
    };

    if (recurrenceMode === 'interval') {
      base.interval_minutes = Number(intervalMinutes);
    } else {
      base.recurrence_pattern = recurrencePattern;
      base.interval = Number(interval) || 1;
      if (recurrencePattern === 'weekly') {
        base.days_of_week = daysOfWeek;
      }
    }

    return base;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = buildPayload();
      if (isEditMode && taskId !== null) {
        await recurringTaskService.updateRecurringTask(taskId, payload as UpdateRecurringTaskPayload);
      } else {
        await recurringTaskService.createRecurringTask(payload);
      }
      onSaved();
    } catch (err: any) {
      Alert.alert(
        'Errore',
        err?.response?.data?.detail || err?.message || 'Salvataggio non riuscito'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {isEditMode ? 'Modifica task ricorrente' : 'Nuovo task ricorrente'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
          </View>

          {loadingTask ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title */}
              <Text style={styles.label}>Titolo *</Text>
              <TextInput
                style={[styles.input, titleError ? styles.inputError : null]}
                value={title}
                onChangeText={t => { setTitle(t); setTitleError(''); }}
                placeholder="es. Stand-up giornaliero"
                placeholderTextColor="#bbb"
                maxLength={100}
              />
              {titleError ? <Text style={styles.errorText}>{titleError}</Text> : null}

              {/* Description */}
              <Text style={styles.label}>Descrizione</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Descrizione opzionale"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={3}
              />

              {/* Start time */}
              <Text style={styles.label}>Data/ora inizio</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateText}>
                  {dayjs(startTime).format('DD/MM/YYYY HH:mm')}
                </Text>
              </TouchableOpacity>

              {/* Priority */}
              <Text style={styles.label}>Priorità</Text>
              <View style={styles.segmentRow}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.segment, priority === p && styles.segmentActive]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.segmentText, priority === p && styles.segmentTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category */}
              {categories.length > 0 && (
                <>
                  <Text style={styles.label}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                    <TouchableOpacity
                      style={[styles.categoryChip, categoryId === null && styles.categoryChipActive]}
                      onPress={() => setCategoryId(null)}
                    >
                      <Text style={[styles.categoryChipText, categoryId === null && styles.categoryChipTextActive]}>
                        Nessuna
                      </Text>
                    </TouchableOpacity>
                    {categories.map((cat: Category) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryChip, categoryId === cat.id && styles.categoryChipActive]}
                        onPress={() => setCategoryId(cat.id)}
                      >
                        <Text style={[styles.categoryChipText, categoryId === cat.id && styles.categoryChipTextActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Recurrence mode */}
              <Text style={styles.label}>Tipo di ricorrenza</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segment, recurrenceMode === 'pattern' && styles.segmentActive]}
                  onPress={() => setRecurrenceMode('pattern')}
                >
                  <Text style={[styles.segmentText, recurrenceMode === 'pattern' && styles.segmentTextActive]}>
                    Schema
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, recurrenceMode === 'interval' && styles.segmentActive]}
                  onPress={() => setRecurrenceMode('interval')}
                >
                  <Text style={[styles.segmentText, recurrenceMode === 'interval' && styles.segmentTextActive]}>
                    Intervallo (min)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom interval */}
              {recurrenceMode === 'interval' && (
                <>
                  <Text style={styles.label}>Ogni N minuti</Text>
                  <TextInput
                    style={styles.input}
                    value={intervalMinutes}
                    onChangeText={setIntervalMinutes}
                    keyboardType="number-pad"
                    placeholder="es. 90"
                    placeholderTextColor="#bbb"
                  />
                </>
              )}

              {/* Pattern */}
              {recurrenceMode === 'pattern' && (
                <>
                  <Text style={styles.label}>Schema</Text>
                  <View style={styles.segmentRow}>
                    {(['daily', 'weekly', 'monthly'] as RecurrencePattern[]).map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.segment, recurrencePattern === p && styles.segmentActive]}
                        onPress={() => setRecurrencePattern(p)}
                      >
                        <Text style={[styles.segmentText, recurrencePattern === p && styles.segmentTextActive]}>
                          {p === 'daily' ? 'Giornaliero' : p === 'weekly' ? 'Settimanale' : 'Mensile'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Ripeti ogni</Text>
                  <TextInput
                    style={styles.input}
                    value={interval}
                    onChangeText={setInterval}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor="#bbb"
                  />

                  {/* Days of week */}
                  {recurrencePattern === 'weekly' && (
                    <>
                      <Text style={styles.label}>Giorni della settimana *</Text>
                      <View style={styles.daysRow}>
                        {DAYS_OF_WEEK.map(d => (
                          <TouchableOpacity
                            key={d.value}
                            style={[styles.dayBtn, daysOfWeek.includes(d.value) && styles.dayBtnActive]}
                            onPress={() => toggleDay(d.value)}
                          >
                            <Text style={[styles.dayText, daysOfWeek.includes(d.value) && styles.dayTextActive]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {daysError ? <Text style={styles.errorText}>{daysError}</Text> : null}
                    </>
                  )}
                </>
              )}

              {/* End condition */}
              <Text style={styles.label}>Fine ricorrenza</Text>
              <View style={styles.segmentRow}>
                {(['never', 'after_count', 'on_date'] as EndType[]).map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.segment, endType === e && styles.segmentActive]}
                    onPress={() => setEndType(e)}
                  >
                    <Text style={[styles.segmentText, endType === e && styles.segmentTextActive]}>
                      {e === 'never' ? 'Mai' : e === 'after_count' ? 'Dopo N' : 'Data'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {endType === 'after_count' && (
                <>
                  <Text style={styles.label}>Numero occorrenze</Text>
                  <TextInput
                    style={styles.input}
                    value={endCount}
                    onChangeText={setEndCount}
                    keyboardType="number-pad"
                    placeholder="es. 10"
                    placeholderTextColor="#bbb"
                  />
                </>
              )}

              {endType === 'on_date' && (
                <>
                  <Text style={styles.label}>Data di fine</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={styles.dateText}>
                      {endDate ? dayjs(endDate).format('DD/MM/YYYY') : 'Seleziona data'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {isEditMode ? 'Salva modifiche' : 'Crea task ricorrente'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Date pickers */}
      <DateTimePickerModal
        isVisible={showStartPicker}
        mode="datetime"
        date={startTime}
        onConfirm={d => { setStartTime(d); setShowStartPicker(false); }}
        onCancel={() => setShowStartPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showEndDatePicker}
        mode="date"
        date={endDate ?? new Date()}
        onConfirm={d => { setEndDate(d); setShowEndDatePicker(false); }}
        onCancel={() => setShowEndDatePicker(false)}
      />
    </Modal>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '300',
    color: '#000',
    letterSpacing: -0.5,
  },
  cancelText: {
    fontSize: 15,
    color: '#007AFF',
  },
  loadingCenter: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  body: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: '#555',
    marginTop: 16,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  dateText: {
    fontSize: 15,
    color: '#000',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segment: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  segmentActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  segmentText: {
    fontSize: 13,
    color: '#555',
  },
  segmentTextActive: {
    color: '#fff',
  },
  categoryRow: {
    flexDirection: 'row',
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#fafafa',
  },
  categoryChipActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#555',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  dayBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  dayTextActive: {
    color: '#fff',
  },
  submitBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    letterSpacing: -0.3,
  },
});

export default CreateRecurringTaskModal;
