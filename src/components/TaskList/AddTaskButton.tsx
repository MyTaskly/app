import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './styles';

export interface AddTaskButtonProps {
  onPress: () => void;
}

export const AddTaskButton = ({ onPress }: AddTaskButtonProps) => {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity style={[styles.addButton, { bottom: 20 + insets.bottom }]} onPress={onPress}>
      <Ionicons name="add" size={28} color="#ffffff" />
    </TouchableOpacity>
  );
};
