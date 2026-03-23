import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { NotesProvider, useNotesActions, useNotesState } from '../../context/NotesContext';
import { NotesCanvas } from '../../components/Notes/NotesCanvas';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const NotesContent: React.FC = () => {
  const { t } = useTranslation();
  const { addNote } = useNotesActions();
  const { isLoading } = useNotesState();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleAddNote = () => {
    scale.value = withSpring(0.9, { duration: 100 }, () => {
      scale.value = withSpring(1, { duration: 100 });
    });
    
    if (Platform.OS === 'ios') {
      Alert.prompt(
        t('notes.newNote'),
        t('notes.newNote'),
        [
          { text: t('common.buttons.cancel'), style: 'cancel' },
          {
            text: t('notes.create'),
            onPress: (text) => {
              if (text && text.trim()) {
                addNote(text.trim());
              }
            }
          }
        ],
        'plain-text'
      );
    } else {
      addNote(t('notes.newNote'));
    }
  };

  return (
    <View style={styles.container}>
      <NotesCanvas />
      
      <Animated.View style={[styles.fabContainer, animatedStyle]}>
          <TouchableOpacity 
            style={[styles.fab, isLoading && styles.fabDisabled]} 
            onPress={handleAddNote}
            disabled={isLoading}
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </Animated.View>
    </View>
  );
};

export default function Notes() {
  return (
    <SafeAreaView style={styles.root}>
      <NotesProvider>
        <NotesContent />
      </NotesProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  fabDisabled: {
    backgroundColor: '#ccc',
    elevation: 2,
  },
});
