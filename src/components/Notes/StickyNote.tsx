import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { X, Palette } from 'lucide-react-native';
import { Note } from '../../services/noteService';
import { useNotesActions } from '../../context/NotesContext';

const NOTE_WIDTH = 200;
const NOTE_HEIGHT = 160;
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.8;

const COLORS = [
  '#FFEB3B', // Giallo post-it classico
  '#FFCDD2', // Rosa chiaro
  '#C8E6C9', // Verde chiaro
  '#BBDEFB', // Blu chiaro
  '#F8BBD0', // Rosa
  '#D1C4E9', // Violetto
  '#B2EBF2', // Ciano
  '#DCEDC8', // Verde lime
  '#FFE0B2', // Arancione chiaro
  '#F3E5F5', // Violetto chiaro
];

export interface StickyNoteProps {
  note: Note;
  canvasScale: SharedValue<number>;
}

export interface StickyNoteRef {
  clearFocus: () => void;
}

export const StickyNote: React.FC<StickyNoteProps> = React.memo(({ note, canvasScale }) => {
  const { updateNote, deleteNote, updateNotePosition } = useNotesActions();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState(note.color);
  const justPressedButtonRef = useRef(false);

  console.log('StickyNote render:', note.id, 'position:', note.position, 'text:', note.text);

  const translateX = useSharedValue(note.position.x);
  const translateY = useSharedValue(note.position.y);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(Math.random() * 6 - 3);
  const opacity = useSharedValue(1);

  const lastTranslateX = useSharedValue(note.position.x);
  const lastTranslateY = useSharedValue(note.position.y);
  const lastScale = useSharedValue(1);

  const isPressed = useSharedValue(false);

  // Definiti PRIMA dei gesture per runOnJS
  const handleStartEditing = useCallback(() => {
    // Ignora il tap se l'utente ha appena premuto un bottone (palette/delete)
    if (justPressedButtonRef.current) {
      justPressedButtonRef.current = false;
      return;
    }
    console.log('Tap detected on note:', note.id, '- toggling editor');
    setIsEditing((prev) => {
      if (prev) {
        // Se era aperto, salva e chiudi
        Keyboard.dismiss();
        return false;
      }
      return true;
    });
  }, [note.id]);

  const panGesture = Gesture.Pan()
    .enabled(!isEditing)
    .minDistance(10)
    .onStart(() => {
      'worklet';
      isPressed.value = true;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      
      rotation.value = withSpring(0);
      scale.value = withSpring(1.05);
      opacity.value = withSpring(0.9);
    })
    .onUpdate((event) => {
      'worklet';
      const GRID_SIZE = 40;
      const GRID_POINTS = 50;
      const CANVAS_SIZE = GRID_POINTS * GRID_SIZE;
      const NOTE_WIDTH = 200;
      const NOTE_HEIGHT = 160;
      
      const newX = lastTranslateX.value + event.translationX / canvasScale.value;
      const newY = lastTranslateY.value + event.translationY / canvasScale.value;
      
      // Limita il movimento della nota entro i confini della griglia
      const minX = 0;
      const maxX = CANVAS_SIZE - NOTE_WIDTH;
      const minY = 0;
      const maxY = CANVAS_SIZE - NOTE_HEIGHT;
      
      translateX.value = Math.max(minX, Math.min(maxX, newX));
      translateY.value = Math.max(minY, Math.min(maxY, newY));
    })
    .onEnd(() => {
      'worklet';
      isPressed.value = false;
      
      scale.value = withSpring(1);
      opacity.value = withSpring(1);
      rotation.value = withSpring(Math.random() * 6 - 3);
      
      const finalPosition = {
        x: translateX.value,
        y: translateY.value,
      };
      
      runOnJS(updateNotePosition)(note.id, finalPosition);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      lastScale.value = scale.value;
    })
    .onUpdate((event) => {
      'worklet';
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, lastScale.value * event.scale));
      scale.value = newScale;
    })
    .onEnd(() => {
      'worklet';
      scale.value = withSpring(scale.value);
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onStart(() => {
      'worklet';
      // Tap singolo apre l'editing
      runOnJS(handleStartEditing)();
    });

  const composedGesture = Gesture.Exclusive(
    Gesture.Simultaneous(panGesture, pinchGesture),
    tapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ] as any,
    opacity: opacity.value,
    zIndex: isPressed.value ? 1000 : note.zIndex || 1,
  }));

  const handleLongPress = () => {
    try {
      console.log('Palette pressed on note:', note.id);
      justPressedButtonRef.current = true;
      Keyboard.dismiss();
      setIsEditing(false);
      setShowColorPicker(true);
      setTimeout(() => { justPressedButtonRef.current = false; }, 300);
    } catch (error) {
      console.error('Error in handleLongPress:', error);
    }
  };

  const handleColorChange = (color: string) => {
    try {
      // Aggiorna il colore locale immediatamente
      setCurrentColor(color);
      
      // Salva il colore sul server
      updateNote(note.id, { color });
      
      // Chiudi il picker
      setShowColorPicker(false);
      
      console.log('Color changed to:', color);
    } catch (error) {
      console.error('Error updating note color:', error);
      setShowColorPicker(false);
    }
  };

  const handleCloseColorPicker = () => {
    setShowColorPicker(false);
  };

  const handleTextSave = useCallback(() => {
    if (editText.trim() !== note.text) {
      updateNote(note.id, { text: editText.trim() });
    }
    Keyboard.dismiss();
    setIsEditing(false);
  }, [editText, note.text, note.id, updateNote]);

  const handleDelete = () => {
    justPressedButtonRef.current = true;
    deleteNote(note.id);
    setTimeout(() => { justPressedButtonRef.current = false; }, 300);
  };

  return (
    <>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <View style={[styles.note, { backgroundColor: currentColor }]}>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.colorButton} onPress={handleLongPress}>
                <Palette size={14} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <X size={14} color="#666" />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <TextInput
                style={styles.textInput}
                value={editText}
                onChangeText={setEditText}
                onBlur={handleTextSave}
                onSubmitEditing={handleTextSave}
                multiline
                autoFocus
                placeholder="Scrivi qui..."
              />
            ) : (
              <View style={styles.textContainer} pointerEvents="none">
                <Text style={styles.text} numberOfLines={5}>
                  {note.text}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>

      <Modal
        visible={showColorPicker}
        transparent
        animationType="fade"
        onRequestClose={handleCloseColorPicker}
      >
        <TouchableOpacity
          style={styles.colorPickerOverlay}
          activeOpacity={1}
          onPress={handleCloseColorPicker}
        >
          <View style={styles.colorPickerModal}>
            <Text style={styles.colorPickerTitle}>Scegli un colore</Text>
            <View style={styles.colorGrid}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    currentColor === color && styles.selectedColor,
                  ]}
                  onPress={() => handleColorChange(color)}
                />
              ))}
            </View>
            <TouchableOpacity
              style={styles.closeColorPicker}
              onPress={handleCloseColorPicker}
            >
              <Text style={styles.closeText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render only if note data or canvasScale reference changes
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.text === nextProps.note.text &&
    prevProps.note.color === nextProps.note.color &&
    prevProps.note.position?.x === nextProps.note.position?.x &&
    prevProps.note.position?.y === nextProps.note.position?.y &&
    prevProps.canvasScale === nextProps.canvasScale
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: NOTE_WIDTH,
    height: NOTE_HEIGHT,
  },
  note: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    gap: 4,
  },
  deleteButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginTop: 28,
    justifyContent: 'space-between',
  },
  text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
    flex: 1,
  },
  textInput: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
    flex: 1,
    marginTop: 28,
    textAlignVertical: 'top',
    padding: 0,
  },
  colorPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: 260,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  colorOption: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  selectedColor: {
    borderColor: '#007AFF',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  closeColorPicker: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});