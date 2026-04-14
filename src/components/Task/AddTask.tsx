import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Ionicons } from "@expo/vector-icons";
import { addTaskToList } from "../TaskList/types";
import { getCategories } from "../../services/taskService";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { RecurrenceConfig as RecurrenceConfigType } from "../../types/recurringTask";
import RecurrenceConfig from "./RecurrenceConfig";

export type AddTaskProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (
    title: string,
    description: string,
    dueDate: string,
    priority: number,
    categoryName?: string,
    recurrence?: RecurrenceConfigType,
    durationMinutes?: number | null
  ) => void;
  categoryName?: string;
  initialDate?: string; // Nuova prop per la data iniziale
  allowCategorySelection?: boolean; // Abilita campo categoria
};

const AddTask: React.FC<AddTaskProps> = ({
  visible,
  onClose,
  onSave,
  categoryName,
  initialDate,
  allowCategorySelection = false,
}) => {
  const { t } = useTranslation();
  const [categoriesOptions, setCategoriesOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [localCategory, setLocalCategory] = useState<string>(
    categoryName || ""
  );
  const [categoryError, setCategoryError] = useState<string>("");
  const [priority, setPriority] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [titleError, setTitleError] = useState<string>("");
  const [dateError, setDateError] = useState<string>("");
  const [date, setDate] = useState(new Date());
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

  // Tipo di scadenza: 'simple' = scadenza semplice, 'recurring' = ripetitività, 'none' = nessuna
  const [deadlineType, setDeadlineType] = useState<'none' | 'simple' | 'recurring'>('none');
  const isRecurring = deadlineType === 'recurring';
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigType>({
    pattern: "daily",
    interval: 1,
    end_type: "never",
  });

  // Duration state
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [customDuration, setCustomDuration] = useState<string>("");

  const DURATION_PRESETS = [
    { label: "15 min", value: 15 },
    { label: "30 min", value: 30 },
    { label: "1 ora", value: 60 },
    { label: "2 ore", value: 120 },
    { label: "4 ore", value: 240 },
  ];

  // Se initialDate è fornito, imposta la data iniziale all'apertura
  useEffect(() => {
    if (visible && initialDate) {
      initializeWithDate(initialDate);
    }
  }, [visible, initialDate]);

  // Carica le categorie se necessario
  useEffect(() => {
    if (allowCategorySelection && visible) {
      getCategories()
        .then((data) => {
          // assume data è array di oggetti con proprietà name
          setCategoriesOptions(
            data.map((cat) => ({ label: cat.name, value: cat.name }))
          );
        })
        .catch((err) => console.error("Errore caricamento categorie:", err));
    }
  }, [allowCategorySelection, visible]);

  // Inizializza la data del task con quella fornita
  const initializeWithDate = (dateStr: string) => {
    const initialDateTime = dayjs(dateStr)
      .hour(12)
      .minute(0)
      .second(0)
      .toDate();
    setSelectedDateTime(initialDateTime);
    setDueDate(initialDateTime.toISOString());
    setDate(initialDateTime);
    setDeadlineType('simple');
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setSelectedDateTime(null);
    setPriority(1);
    setTitleError("");
    setDateError("");
    setLocalCategory(categoryName || "");
    setCategoryError("");
    setDeadlineType('none');
    setRecurrenceConfig({
      pattern: "daily",
      interval: 1,
      end_type: "never",
    });
    setDurationMinutes(null);
    setCustomDuration("");
  };

  const handleSave = () => {
    let hasError = false;

    if (!title.trim()) {
      setTitleError("Il titolo è obbligatorio");
      hasError = true;
    }

    if (allowCategorySelection && !localCategory.trim()) {
      setCategoryError("La categoria è obbligatoria");
      hasError = true;
    }

    // La data di scadenza è ora opzionale, non aggiungiamo più la validazione

    if (hasError) {
      return;
    }

    const priorityString =
      priority === 1 ? "Bassa" : priority === 2 ? "Media" : "Alta";

    const taskObject: any = {
      id: Date.now(),
      title: title.trim(),
      description: description.trim() || "", // Assicurarsi che description non sia mai null
      end_time: dueDate || null, // Se non c'è una data di scadenza, imposta null
      start_time: new Date().toISOString(),
      priority: priorityString,
      status: "In sospeso", // Aggiornato per coerenza con altri componenti
      category_name: allowCategorySelection
        ? localCategory
        : categoryName || "", // Aggiungere il nome della categoria
      user: "", // Campo richiesto dal server
      completed: false,
      duration_minutes: durationMinutes || null, // Durata stimata in minuti
    };

    // Add recurring task fields if enabled
    if (isRecurring) {
      taskObject.is_recurring = true;
      taskObject.recurrence_pattern = recurrenceConfig.pattern;
      taskObject.recurrence_interval = recurrenceConfig.interval;
      taskObject.recurrence_end_type = recurrenceConfig.end_type;

      // Add pattern-specific fields
      if (recurrenceConfig.pattern === "weekly" && recurrenceConfig.days_of_week) {
        taskObject.recurrence_days_of_week = recurrenceConfig.days_of_week;
      }
      if (recurrenceConfig.pattern === "monthly" && recurrenceConfig.day_of_month) {
        taskObject.recurrence_day_of_month = recurrenceConfig.day_of_month;
      }

      // Add end-type-specific fields
      if (recurrenceConfig.end_type === "on_date" && recurrenceConfig.end_date) {
        taskObject.recurrence_end_date = recurrenceConfig.end_date;
      }
      if (recurrenceConfig.end_type === "after_count" && recurrenceConfig.end_count) {
        taskObject.recurrence_end_count = recurrenceConfig.end_count;
      }
    }

    try {
      if (onSave) {
        // Se c'è onSave, usa quello (TaskListContainer gestirà la chiamata al server)
        onSave(
          title,
          description,
          dueDate,
          priority,
          allowCategorySelection ? localCategory : categoryName,
          isRecurring ? recurrenceConfig : undefined,
          durationMinutes
        );
      } else if (categoryName) {
        // Solo se non c'è onSave, usa addTaskToList per compatibilità
        console.log(
          "Direct call to addTaskToList from AddTask with category:",
          categoryName
        );
        addTaskToList(taskObject, categoryName);
      }
    } catch (error) {
      console.error("Error saving task:", error);
      Alert.alert("Error", "Failed to save task");
    } finally {
      resetForm();
      handleCancel();
    }
  };

  const onChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setDate(currentDate);

    if (selectedDateTime) {
      const newDateTime = new Date(currentDate);
      newDateTime.setHours(
        selectedDateTime.getHours(),
        selectedDateTime.getMinutes()
      );
      setSelectedDateTime(newDateTime);
      setDueDate(newDateTime.toISOString());
    } else {
      setSelectedDateTime(currentDate);
      setDueDate(currentDate.toISOString());
    }
    setDateError("");
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    const currentTime = selectedTime || date;

    if (selectedDateTime) {
      const newDateTime = new Date(selectedDateTime);
      newDateTime.setHours(currentTime.getHours(), currentTime.getMinutes());
      setSelectedDateTime(newDateTime);
      setDueDate(newDateTime.toISOString());
    } else {
      setSelectedDateTime(currentTime);
      setDueDate(currentTime.toISOString());
    }
    setDateError("");
  };

  const hidePicker = () => setPickerVisible(false);
  const showDatepicker = () => {
    setPickerMode("date");
    setPickerVisible(true);
  };
  const showTimepicker = () => {
    setPickerMode("time");
    setPickerVisible(true);
  };


  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Aggiungi Task</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Ionicons name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent}>
            {allowCategorySelection && (
              <>
                <Text style={styles.inputLabel}>Categoria *</Text>
                <View
                  style={[
                    styles.dropdown,
                    categoryError ? styles.inputError : null,
                  ]}
                >
                  <Picker
                    selectedValue={localCategory}
                    onValueChange={(itemValue) => {
                      setLocalCategory(itemValue as string);
                      if (itemValue) setCategoryError("");
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleziona categoria" value="" />
                    {categoriesOptions.map((option, index) => (
                      <Picker.Item
                        key={index}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </View>
                {categoryError ? (
                  <Text style={styles.errorText}>{categoryError}</Text>
                ) : null}
              </>
            )}

            <Text style={styles.inputLabel}>Titolo *</Text>
            <TextInput
              style={[styles.input, titleError ? styles.inputError : null]}
              placeholder="Inserisci il titolo"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (text.trim()) setTitleError("");
              }}
            />
            {titleError ? (
              <Text style={styles.errorText}>{titleError}</Text>
            ) : null}

            <Text style={styles.inputLabel}>Descrizione</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Inserisci la descrizione"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />

            {/* Segmented control: Scadenza semplice / Ripetitività */}
            <Text style={styles.inputLabel}>Scadenza</Text>
            <View style={styles.deadlineTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.deadlineTypeButton,
                  styles.deadlineTypeButtonLeft,
                  deadlineType === 'simple' && styles.deadlineTypeButtonActive,
                ]}
                onPress={() => {
                  setDeadlineType(deadlineType === 'simple' ? 'none' : 'simple');
                  if (deadlineType === 'simple') {
                    setSelectedDateTime(null);
                    setDueDate("");
                  }
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={deadlineType === 'simple' ? "#ffffff" : "#666666"}
                />
                <Text style={[
                  styles.deadlineTypeText,
                  deadlineType === 'simple' && styles.deadlineTypeTextActive,
                ]}>
                  Scadenza semplice
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deadlineTypeButton,
                  styles.deadlineTypeButtonRight,
                  deadlineType === 'recurring' && styles.deadlineTypeButtonActive,
                ]}
                onPress={() => {
                  setDeadlineType(deadlineType === 'recurring' ? 'none' : 'recurring');
                  if (deadlineType === 'recurring') {
                    setSelectedDateTime(null);
                    setDueDate("");
                  }
                }}
              >
                <Ionicons
                  name="repeat"
                  size={16}
                  color={deadlineType === 'recurring' ? "#ffffff" : "#666666"}
                />
                <Text style={[
                  styles.deadlineTypeText,
                  deadlineType === 'recurring' && styles.deadlineTypeTextActive,
                ]}>
                  Ripetitività
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scadenza semplice: date/time picker */}
            {deadlineType === 'simple' && (
              <View style={styles.deadlineContent}>
                <View style={[styles.dateTimeContainer, { marginBottom: 0 }]}>
                  <TouchableOpacity
                    style={[styles.datePickerButton, styles.dateButton]}
                    onPress={showDatepicker}
                  >
                    <Text style={styles.datePickerText}>
                      {selectedDateTime
                        ? selectedDateTime.toLocaleDateString("it-IT")
                        : "Seleziona data"}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.datePickerButton, styles.timeButton]}
                    onPress={showTimepicker}
                    disabled={!selectedDateTime}
                  >
                    <Text
                      style={[
                        styles.datePickerText,
                        !selectedDateTime && styles.disabledText,
                      ]}
                    >
                      {selectedDateTime
                        ? selectedDateTime.toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Ora"}
                    </Text>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={selectedDateTime ? "#666" : "#ccc"}
                    />
                  </TouchableOpacity>

                  {selectedDateTime && (
                    <TouchableOpacity
                      style={styles.clearDateIconButton}
                      onPress={() => {
                        setSelectedDateTime(null);
                        setDueDate("");
                        setDateError("");
                      }}
                    >
                      <Ionicons name="close-circle" size={22} color="#cccccc" />
                    </TouchableOpacity>
                  )}
                </View>

                {dateError ? (
                  <Text style={[styles.errorText, { marginTop: 8, marginBottom: 0 }]}>{dateError}</Text>
                ) : null}
              </View>
            )}

            {/* Ripetitività: RecurrenceConfig */}
            {deadlineType === 'recurring' && (
              <View style={styles.recurringConfigContainer}>
                <RecurrenceConfig
                  value={recurrenceConfig}
                  onChange={setRecurrenceConfig}
                />
              </View>
            )}

            <Text style={[styles.inputLabel, { marginTop: 20 }]}>Priorità</Text>
            <View style={styles.priorityContainer}>
              <TouchableOpacity
                style={[
                  styles.priorityButton,
                  styles.priorityButtonLow,
                  priority === 1 && styles.priorityButtonActive,
                ]}
                onPress={() => setPriority(1)}
              >
                <Text
                  style={[
                    styles.priorityButtonText,
                    priority === 1 && styles.priorityButtonTextActive,
                  ]}
                >
                  Bassa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.priorityButton,
                  styles.priorityButtonMedium,
                  priority === 2 && styles.priorityButtonActive,
                ]}
                onPress={() => setPriority(2)}
              >
                <Text
                  style={[
                    styles.priorityButtonText,
                    priority === 2 && styles.priorityButtonTextActive,
                  ]}
                >
                  Media
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.priorityButton,
                  styles.priorityButtonHigh,
                  priority === 3 && styles.priorityButtonActive,
                ]}
                onPress={() => setPriority(3)}
              >
                <Text
                  style={[
                    styles.priorityButtonText,
                    priority === 3 && styles.priorityButtonTextActive,
                  ]}
                >
                  Alta
                </Text>
              </TouchableOpacity>
            </View>

            {/* Duration selector */}
            <Text style={styles.inputLabel}>Durata stimata (opzionale)</Text>
            <View style={styles.durationContainer}>
              {DURATION_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  style={[
                    styles.durationChip,
                    durationMinutes === preset.value && styles.durationChipActive,
                  ]}
                  onPress={() => {
                    if (durationMinutes === preset.value) {
                      setDurationMinutes(null);
                      setCustomDuration("");
                    } else {
                      setDurationMinutes(preset.value);
                      setCustomDuration("");
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      durationMinutes === preset.value && styles.durationChipTextActive,
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
                    setDurationMinutes(val);
                  } else if (numericText === "") {
                    setDurationMinutes(null);
                  }
                }}
              />
              {durationMinutes && (
                <TouchableOpacity
                  style={styles.clearDurationButton}
                  onPress={() => {
                    setDurationMinutes(null);
                    setCustomDuration("");
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View style={styles.formFooter}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salva</Text>
            </TouchableOpacity>
          </View>
          <DateTimePickerModal
            isVisible={isPickerVisible}
            mode={pickerMode}
            date={selectedDateTime || date}
            onConfirm={(picked) => {
              if (pickerMode === "date") onChange(null, picked);
              else onTimeChange(null, picked);
              hidePicker();
            }}
            onCancel={hidePicker}
            is24Hour={true}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  formContainer: {
    width: "100%",
    height: "92%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
    backgroundColor: "#ffffff",
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "300",
    color: "#000000",
    fontFamily: "System",
    letterSpacing: -0.5,
  },
  formContent: {
    padding: 24,
  },
  formFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#e1e5e9",
    alignItems: "center",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "400",
    marginBottom: 12,
    color: "#000000",
    fontFamily: "System",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e1e5e9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    fontSize: 17,
    backgroundColor: "#ffffff",
    fontFamily: "System",
    fontWeight: "400",
    color: "#000000",
  },
  textArea: {
    height: 120,
  },
  inputError: {
    borderColor: "#FF5252",
    backgroundColor: "#FFF8F8",
  },
  errorText: {
    color: "#FF5252",
    fontSize: 14,
    marginBottom: 12,
    marginTop: -8,
    fontFamily: "System",
  },
  dateTimeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  datePickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e1e5e9",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dateButton: {
    flex: 3,
    marginRight: 12,
  },
  timeButton: {
    flex: 2,
  },
  datePickerText: {
    fontSize: 17,
    color: "#000000",
    fontFamily: "System",
    fontWeight: "400",
  },
  priorityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  priorityButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 10,
    alignItems: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  priorityButtonLow: {
    borderColor: "#e1e5e9",
    backgroundColor: "#ffffff",
  },
  priorityButtonMedium: {
    borderColor: "#e1e5e9",
    backgroundColor: "#ffffff",
  },
  priorityButtonHigh: {
    borderColor: "#e1e5e9",
    backgroundColor: "#ffffff",
  },
  priorityButtonActive: {
    borderWidth: 2,
    borderColor: "#000000",
    backgroundColor: "#f8f8f8",
  },
  priorityButtonText: {
    fontWeight: "400",
    fontSize: 16,
    color: "#666666",
    fontFamily: "System",
  },
  priorityButtonTextActive: {
    fontWeight: "500",
    color: "#000000",
  },
  saveButton: {
    backgroundColor: "#000000",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "400",
    fontSize: 17,
    fontFamily: "System",
  },
  dropdown: {
    borderWidth: 1.5,
    borderColor: "#e1e5e9",
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  picker: {
    height: 50,
    color: "#000000",
  },
  disabledText: {
    color: "#ccc",
  },
  clearDateIconButton: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 8,
  },
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
    fontWeight: "400",
    color: "#666666",
    fontFamily: "System",
  },
  deadlineTypeTextActive: {
    color: "#ffffff",
    fontWeight: "500",
  },
  deadlineContent: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#f8f8f8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  recurringConfigContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#f8f8f8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  durationContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e1e5e9",
    backgroundColor: "#ffffff",
  },
  durationChipActive: {
    borderColor: "#000000",
    backgroundColor: "#f8f8f8",
    borderWidth: 2,
  },
  durationChipText: {
    fontSize: 14,
    color: "#666666",
    fontFamily: "System",
    fontWeight: "400",
  },
  durationChipTextActive: {
    color: "#000000",
    fontWeight: "500",
  },
  customDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  customDurationInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e1e5e9",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    backgroundColor: "#ffffff",
    fontFamily: "System",
    color: "#000000",
  },
  clearDurationButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default AddTask;
