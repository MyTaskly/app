import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Alert, StyleSheet } from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { styles } from "./TaskStyles";
import { PrioritySelector, StatusSelector, DatePickerButton, TimePickerButton } from "./FormComponents";
import { RecurrenceConfig } from "./RecurrenceConfig";
import { RecurrenceConfig as RecurrenceConfigType } from "../../types/recurringTask";

const DURATION_PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 ora", value: 60 },
  { label: "2 ore", value: 120 },
  { label: "4 ore", value: 240 },
];

// Componente per il modal di modifica
const TaskEditModal = ({ 
  visible, 
  task, 
  onClose, 
  onSave 
}) => {
  const [editedTask, setEditedTask] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    priority: "",
    status: "",
    duration_minutes: null as number | null,
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [dateType, setDateType] = useState('end'); // 'start' o 'end'
  const [customDuration, setCustomDuration] = useState<string>("");
  const [deadlineType, setDeadlineType] = useState<'none' | 'simple' | 'recurring'>('none');
  const isRecurring = deadlineType === 'recurring';
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigType>({
    pattern: 'daily',
    interval: 1,
    end_type: 'never',
  });

  // Quando il modale diventa visibile, inizializza i campi
  useEffect(() => {
    if (visible && task) {
      setEditedTask({
        title: task.title,
        description: task.description || "",
        start_time: task.start_time || new Date().toISOString(),
        end_time: task.end_time,
        priority: task.priority,
        status: task.status || "In sospeso",
        duration_minutes: task.duration_minutes ?? null,
      });
      setCustomDuration(task.duration_minutes ? String(task.duration_minutes) : "");

      if (task.is_recurring) {
        setDeadlineType('recurring');
        setRecurrenceConfig({
          pattern: (task.recurrence_pattern as any) || 'daily',
          interval: task.recurrence_interval || 1,
          days_of_week: task.recurrence_days_of_week,
          day_of_month: task.recurrence_day_of_month,
          end_type: (task.recurrence_end_type as any) || 'never',
          end_date: task.recurrence_end_date,
          end_count: task.recurrence_end_count,
        });
      } else if (task.end_time) {
        setDeadlineType('simple');
        setRecurrenceConfig({ pattern: 'daily', interval: 1, end_type: 'never' });
      } else {
        setDeadlineType('none');
        setRecurrenceConfig({ pattern: 'daily', interval: 1, end_type: 'never' });
      }
    }
  }, [visible, task]);

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    setShowTimePicker(false);
    
    if (selectedDate) {
      const currentDate = dateType === 'end' 
        ? (editedTask.end_time ? new Date(editedTask.end_time) : new Date())
        : (editedTask.start_time ? new Date(editedTask.start_time) : new Date());
      
      if (pickerMode === 'date') {
        currentDate.setFullYear(selectedDate.getFullYear());
        currentDate.setMonth(selectedDate.getMonth());
        currentDate.setDate(selectedDate.getDate());
      } else {
        currentDate.setHours(selectedDate.getHours());
        currentDate.setMinutes(selectedDate.getMinutes());
      }
      
      if (dateType === 'end') {
        setEditedTask({...editedTask, end_time: currentDate.toISOString()});
      } else {
        setEditedTask({...editedTask, start_time: currentDate.toISOString()});
      }
    }
  };

  const openDatePicker = (type) => {
    setDateType(type);
    setPickerMode('date');
    setShowDatePicker(true);
  };

  const openTimePicker = (type) => {
    setDateType(type);
    setPickerMode('time');
    setShowTimePicker(true);
  };

  const handleSave = () => {
    if (!editedTask.title.trim()) {
      Alert.alert("Errore", "Il titolo è obbligatorio");
      return;
    }

    const taskData: any = { ...editedTask };

    if (isRecurring) {
      taskData.is_recurring = true;
      taskData.end_time = null;
      taskData.recurrence_pattern = recurrenceConfig.pattern;
      taskData.recurrence_interval = recurrenceConfig.interval;
      taskData.recurrence_days_of_week = recurrenceConfig.days_of_week;
      taskData.recurrence_day_of_month = recurrenceConfig.day_of_month;
      taskData.recurrence_end_type = recurrenceConfig.end_type;
      taskData.recurrence_end_date = recurrenceConfig.end_date;
      taskData.recurrence_end_count = recurrenceConfig.end_count;
    } else {
      taskData.is_recurring = false;
      taskData.recurrence_pattern = undefined;
      taskData.recurrence_interval = undefined;
      taskData.recurrence_days_of_week = undefined;
      taskData.recurrence_day_of_month = undefined;
      taskData.recurrence_end_type = undefined;
      taskData.recurrence_end_date = undefined;
      taskData.recurrence_end_count = undefined;
    }

    onSave(taskData);
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.editModalOverlay}>
        <View style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>Modifica Task</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={[styles.editModalContent, { flex: 1 }]} contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={styles.inputLabel}>Titolo *</Text>
            <TextInput
              style={styles.input}
              value={editedTask.title}
              onChangeText={(text) => setEditedTask({...editedTask, title: text})}
              placeholder="Titolo del task"
            />
            
            <Text style={styles.inputLabel}>Descrizione</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editedTask.description}
              onChangeText={(text) => setEditedTask({...editedTask, description: text})}
              placeholder="Descrizione del task"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            {/* Segmented control: Scadenza semplice / Ripetitività */}
            <Text style={styles.inputLabel}>Scadenza</Text>
            <View style={editStyles.deadlineTypeContainer}>
              <TouchableOpacity
                style={[
                  editStyles.deadlineTypeButton,
                  editStyles.deadlineTypeButtonLeft,
                  deadlineType === 'simple' && editStyles.deadlineTypeButtonActive,
                ]}
                onPress={() => {
                  setDeadlineType(deadlineType === 'simple' ? 'none' : 'simple');
                  if (deadlineType === 'simple') {
                    setEditedTask({...editedTask, end_time: null});
                  }
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={deadlineType === 'simple' ? "#ffffff" : "#666666"}
                />
                <Text style={[
                  editStyles.deadlineTypeText,
                  deadlineType === 'simple' && editStyles.deadlineTypeTextActive,
                ]}>
                  Scadenza semplice
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  editStyles.deadlineTypeButton,
                  editStyles.deadlineTypeButtonRight,
                  deadlineType === 'recurring' && editStyles.deadlineTypeButtonActive,
                ]}
                onPress={() => {
                  setDeadlineType(deadlineType === 'recurring' ? 'none' : 'recurring');
                  if (deadlineType === 'recurring') {
                    setEditedTask({...editedTask, end_time: null});
                  }
                }}
              >
                <Ionicons
                  name="repeat"
                  size={16}
                  color={deadlineType === 'recurring' ? "#ffffff" : "#666666"}
                />
                <Text style={[
                  editStyles.deadlineTypeText,
                  deadlineType === 'recurring' && editStyles.deadlineTypeTextActive,
                ]}>
                  Ripetitività
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scadenza semplice */}
            {deadlineType === 'simple' && (
              <View style={editStyles.deadlineContent}>
                <View style={[styles.dateTimeContainer, { marginBottom: 0 }]}>
                  <View style={styles.dateButton}>
                    <DatePickerButton
                      value={editedTask.end_time}
                      onPress={() => openDatePicker('end')}
                      placeholder="Seleziona data"
                    />
                  </View>
                  <View style={styles.timeButton}>
                    <TimePickerButton
                      value={editedTask.end_time}
                      onPress={() => editedTask.end_time ? openTimePicker('end') : null}
                      placeholder="Ora"
                    />
                  </View>
                </View>
                {editedTask.end_time && (
                  <TouchableOpacity
                    style={[styles.clearDateButton, { marginTop: 8, marginBottom: 0 }]}
                    onPress={() => setEditedTask({...editedTask, end_time: null})}
                  >
                    <Text style={styles.clearDateText}>Rimuovi scadenza</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Ripetitività */}
            {deadlineType === 'recurring' && (
              <View style={editStyles.deadlineContent}>
                <RecurrenceConfig value={recurrenceConfig} onChange={setRecurrenceConfig} />
              </View>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={dateType === 'end'
                  ? (editedTask.end_time ? new Date(editedTask.end_time) : new Date())
                  : (editedTask.start_time ? new Date(editedTask.start_time) : new Date())}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={dateType === 'end'
                  ? (editedTask.end_time ? new Date(editedTask.end_time) : new Date())
                  : (editedTask.start_time ? new Date(editedTask.start_time) : new Date())}
                mode="time"
                display="default"
                onChange={handleDateChange}
                is24Hour={true}
              />
            )}

            <Text style={[styles.inputLabel, { marginTop: 20 }]}>Priorità</Text>
            <PrioritySelector
              value={editedTask.priority}
              onChange={(priority) => setEditedTask({...editedTask, priority})}
            />

            <Text style={styles.inputLabel}>Stato</Text>
            <StatusSelector
              value={editedTask.status}
              onChange={(status) => setEditedTask({...editedTask, status})}
            />

            <Text style={styles.inputLabel}>Durata stimata (opzionale)</Text>
            <View style={styles.durationContainer}>
              {DURATION_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  style={[
                    styles.durationChip,
                    editedTask.duration_minutes === preset.value && styles.durationChipActive,
                  ]}
                  onPress={() => {
                    if (editedTask.duration_minutes === preset.value) {
                      setEditedTask({...editedTask, duration_minutes: null});
                      setCustomDuration("");
                    } else {
                      setEditedTask({...editedTask, duration_minutes: preset.value});
                      setCustomDuration("");
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      editedTask.duration_minutes === preset.value && styles.durationChipTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.customDurationRow}>
              <TextInput
                style={styles.customDurationInput}
                placeholder="Personalizzata (minuti)"
                keyboardType="numeric"
                value={customDuration}
                onChangeText={(text) => {
                  const numericText = text.replace(/[^0-9]/g, "");
                  setCustomDuration(numericText);
                  const val = parseInt(numericText, 10);
                  if (val >= 1 && val <= 10080) {
                    setEditedTask({...editedTask, duration_minutes: val});
                  } else if (numericText === "") {
                    setEditedTask({...editedTask, duration_minutes: null});
                  }
                }}
              />
              {editedTask.duration_minutes && (
                <TouchableOpacity
                  style={styles.clearDurationButton}
                  onPress={() => {
                    setEditedTask({...editedTask, duration_minutes: null});
                    setCustomDuration("");
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
          
          <View style={styles.editModalFooter}>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Salva Modifiche</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const editStyles = StyleSheet.create({
  deadlineTypeContainer: {
    flexDirection: "row",
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#e1e5e9",
    overflow: "hidden",
  },
  deadlineTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  deadlineTypeButtonLeft: {
    borderRightWidth: 0.75,
    borderRightColor: "#e1e5e9",
  },
  deadlineTypeButtonRight: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#e1e5e9",
  },
  deadlineTypeButtonActive: {
    backgroundColor: "#000000",
  },
  deadlineTypeText: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: "#666666",
    fontFamily: "System",
  },
  deadlineTypeTextActive: {
    color: "#ffffff",
    fontWeight: "500" as const,
  },
  deadlineContent: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#f8f8f8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
});

export default TaskEditModal;