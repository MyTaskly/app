import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  Image,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { addCategory, CategoryLimitError } from "../../services/taskService";
import { emitCategoryAdded } from "../../utils/eventEmitter";

// Definiamo un'interfaccia chiara per i dati della categoria
export interface CategoryData {
  id: string | number;
  name: string;
  description?: string;
  category_id?: number;
  status_code?: number;
}

export interface AddCategoryButtonProps {
  onCategoryAdded: (category: CategoryData) => void;
}

const AddCategoryButton: React.FC<AddCategoryButtonProps> = ({
  onCategoryAdded,
}) => {
  const [formVisible, setFormVisible] = useState(false);
  const animationValue = useSharedValue(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleForm = () => {
    setFormVisible(true);
    animationValue.value = withSpring(1, { damping: 12 });
  };

  const handleCancel = () => {
    // pulisci i campi di immissione
    setName("");
    setDescription("");
    // chiudi il form
    animationValue.value = withSpring(0, { damping: 12 });
    setTimeout(() => setFormVisible(false), 300);
  };

  const handleSave = async () => {
    if (name.trim() === "") {
      Alert.alert("Errore", "Il nome della categoria non può essere vuoto");
      return;
    }

    try {
      setIsSubmitting(true);

      // Crea un oggetto categoria con un ID temporaneo
      const newCategory: CategoryData = {
        id: Date.now(),
        name: name.trim(),
        description: description.trim(),
      };

      console.log("Nuova categoria creata localmente:", newCategory);

      try {
        // Salva la categoria nel backend
        const savedCategory = await addCategory(newCategory);
        console.log("Categoria salvata dal server:", savedCategory);

        // Usa la categoria restituita dal server se disponibile
        if (savedCategory) {
          // Prepara un oggetto completo combinando i dati locali con quelli del server
          const completeCategory: CategoryData = {
            // Mantieni i dati originali
            name: newCategory.name,
            description: newCategory.description,
            // Usa l'ID del server se disponibile, altrimenti quello locale
            id: savedCategory.category_id || savedCategory.id || newCategory.id,
            // Aggiungi altri campi dal server
            category_id: savedCategory.category_id,
            status_code: savedCategory.status_code,
          };

          // Emetti l'evento per notificare che è stata aggiunta una categoria
          emitCategoryAdded(completeCategory);

          // Chiamata alla funzione di callback originale
          onCategoryAdded(completeCategory);
        } else {
          // In caso di problemi, usiamo la versione locale
          console.log(
            "Chiamata a onCategoryAdded con newCategory (server non ha risposto):",
            newCategory
          );
          emitCategoryAdded(newCategory);
          onCategoryAdded(newCategory);
        }
      } catch (error) {
        if (error instanceof CategoryLimitError) {
          Alert.alert(
            "Limite categorie raggiunto",
            "Hai raggiunto il numero massimo di categorie per il tuo piano. Fai l'upgrade per aggiungerne altre."
          );
          return;
        }
        console.error("Errore nel salvare la categoria sul server:", error);
        // In caso di errore del server, aggiungiamo comunque la categoria localmente
        console.log(
          "Chiamata a onCategoryAdded con newCategory (errore server):",
          newCategory
        );
        emitCategoryAdded(newCategory);
        onCategoryAdded(newCategory);
      }

      // Chiudi il form
      handleCancel();
    } catch (error) {
      console.error("Errore nell'aggiunta della categoria:", error);
      Alert.alert("Errore", "Non è stato possibile aggiungere la categoria");
    } finally {
      setIsSubmitting(false);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animationValue.value }],
    opacity: animationValue.value,
  }));

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={toggleForm}>
        <Image
          source={require("../../assets/plus.png")}
          style={styles.addButtonIcon}
        />
      </TouchableOpacity>

      <Modal visible={formVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.formContainer, animatedStyle]}>
            <KeyboardAvoidingView behavior="padding" style={styles.formContent}>
              <Text style={styles.label}>Nome Categoria</Text>
              <TextInput
                style={styles.input}
                placeholder="Inserisci il nome della categoria"
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.label}>Descrizione</Text>
              <TextInput
                style={styles.input}
                placeholder="Inserisci la descrizione"
                multiline
                value={description}
                onChangeText={setDescription}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSave}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? "Salvataggio..." : "Salva"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Annulla</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    position: "absolute",
    bottom: 0,
    left: 20,
    backgroundColor: "#000000", // Cambiato da #007BFF a #000000 per coerenza con Home20
    width: 56, // Leggermente più grande per un aspetto più moderno
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08, // Stesso valore di Home20
    shadowRadius: 12, // Stesso valore di Home20
    elevation: 3, // Stesso valore di Home20
  },
  addButtonIcon: {
    width: 28,
    height: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)", // Leggermente più scuro per modernità
    justifyContent: "center",
    alignItems: "center",
  },
  formContainer: {
    width: "85%", // Leggermente più largo
    backgroundColor: "#ffffff", // Bianco puro come Home20
    borderRadius: 16, // Più arrotondato per modernità
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  formContent: {
    padding: 34, // Incrementato da 24 a 34 (+10px)
  },
  label: {
    fontSize: 16, // Leggermente più grande
    color: "#000000", // Nero per coerenza con Home20
    marginBottom: 8,
    fontFamily: "System",
    fontWeight: "400",
  },
  input: {
    borderWidth: 1.5, // Stesso spessore dell'input di Home20
    borderColor: "#e1e5e9", // Stesso colore del bordo dell'input di Home20
    borderRadius: 12, // Più arrotondato
    padding: 16, // Più padding come Home20
    marginBottom: 20,
    fontSize: 17, // Stessa dimensione dell'input di Home20
    fontFamily: "System",
    fontWeight: "400",
    backgroundColor: "#ffffff",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 20, // Aggiunto marginBottom
    gap: 12, // Aggiunge spazio uniforme tra i bottoni
  },
  submitButton: {
    backgroundColor: "#000000", // Nero come Home20
    paddingVertical: 16, // Più padding
    alignItems: "center",
    borderRadius: 12, // Più arrotondato
    flex: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "System",
    fontWeight: "500", // Leggermente più grassetto
  },
  cancelButton: {
    backgroundColor: "#f0f0f0", // Stesso colore del pulsante send di Home20
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e1e5e9",
  },
  cancelButtonText: {
    color: "#000000", // Nero per coerenza
    fontSize: 16,
    fontFamily: "System",
    fontWeight: "400",
  },
});

export default AddCategoryButton;
