import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../services/axiosInstance';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEMORY_ENABLED_KEY = 'memory_enabled';

interface Memory {
  id: string;
  memory: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export default function MemorySettingsScreen() {
  const { t } = useTranslation();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [inputText, setInputText] = useState('');
  const [savingModal, setSavingModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [memoriesRes, enabledStr] = await Promise.all([
        axiosInstance.get('/memory/'),
        AsyncStorage.getItem(MEMORY_ENABLED_KEY),
      ]);
      setMemories(memoriesRes.data.memories || []);
      setMemoryEnabled(enabledStr !== 'false');
    } catch (error) {
      console.error('[MemorySettings] Error loading memories:', error);
      Alert.alert(t('common.messages.error'), t('memorySettings.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMemory = async (value: boolean) => {
    try {
      await AsyncStorage.setItem(MEMORY_ENABLED_KEY, String(value));
      setMemoryEnabled(value);
    } catch (error) {
      console.error('[MemorySettings] Error saving toggle:', error);
    }
  };

  const openAddModal = () => {
    setEditingMemory(null);
    setInputText('');
    setModalVisible(true);
  };

  const openEditModal = (memory: Memory) => {
    setEditingMemory(memory);
    setInputText(memory.memory);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingMemory(null);
    setInputText('');
  };

  const handleSaveMemory = async () => {
    if (!inputText.trim()) return;
    setSavingModal(true);
    try {
      if (editingMemory) {
        await axiosInstance.put(`/memory/${editingMemory.id}`, { content: inputText.trim() });
      } else {
        await axiosInstance.post('/memory/', { content: inputText.trim() });
      }
      closeModal();
      await loadData();
    } catch (error) {
      console.error('[MemorySettings] Error saving memory:', error);
      Alert.alert(t('common.messages.error'), t('memorySettings.errors.saveFailed'));
    } finally {
      setSavingModal(false);
    }
  };

  const handleDeleteMemory = (memory: Memory) => {
    Alert.alert(
      t('memorySettings.deleteConfirm.title'),
      t('memorySettings.deleteConfirm.message'),
      [
        { text: t('common.buttons.cancel'), style: 'cancel' },
        {
          text: t('common.buttons.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(memory.id);
            try {
              await axiosInstance.delete(`/memory/${memory.id}`);
              setMemories((prev) => prev.filter((m) => m.id !== memory.id));
            } catch (error) {
              console.error('[MemorySettings] Error deleting memory:', error);
              Alert.alert(t('common.messages.error'), t('memorySettings.errors.deleteFailed'));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAll = () => {
    Alert.alert(
      t('memorySettings.deleteAll.title'),
      t('memorySettings.deleteAll.message'),
      [
        { text: t('common.buttons.cancel'), style: 'cancel' },
        {
          text: t('memorySettings.deleteAll.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete('/memory/');
              setMemories([]);
            } catch (error) {
              console.error('[MemorySettings] Error deleting all memories:', error);
              Alert.alert(t('common.messages.error'), t('memorySettings.errors.deleteAllFailed'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>{t('memorySettings.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── ENABLE/DISABLE MEMORY ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('memorySettings.sections.toggle')}</Text>
          <Text style={styles.sectionDescription}>{t('memorySettings.sections.toggleDesc')}</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.rowLeft}>
            <Ionicons name="bookmark-outline" size={22} color="#000000" />
            <Text style={styles.rowLabel}>{t('memorySettings.enableMemory')}</Text>
          </View>
          <Switch
            value={memoryEnabled}
            onValueChange={handleToggleMemory}
            trackColor={{ false: '#dee2e6', true: '#000000' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* ── MEMORIES LIST ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('memorySettings.sections.list')}</Text>
          <Text style={styles.sectionDescription}>{t('memorySettings.sections.listDesc')}</Text>
        </View>

        {memories.length === 0 && (
          <View style={styles.emptyRow}>
            <Ionicons name="layers-outline" size={20} color="#adb5bd" />
            <Text style={styles.emptyText}>{t('memorySettings.empty')}</Text>
          </View>
        )}

        {memories.map((memory, index) => (
          <View
            key={memory.id}
            style={[
              styles.memoryRow,
              index === memories.length - 1 && styles.memoryRowLast,
            ]}
          >
            <Text style={styles.memoryText} numberOfLines={3}>
              {memory.memory}
            </Text>
            <View style={styles.memoryActions}>
              <TouchableOpacity
                onPress={() => openEditModal(memory)}
                style={styles.actionButton}
                activeOpacity={0.7}
                disabled={deletingId === memory.id}
              >
                <Ionicons name="pencil-outline" size={18} color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteMemory(memory)}
                style={styles.actionButton}
                activeOpacity={0.7}
                disabled={deletingId === memory.id}
              >
                {deletingId === memory.id ? (
                  <ActivityIndicator size="small" color="#dc3545" />
                ) : (
                  <Ionicons name="trash-outline" size={18} color="#dc3545" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Add memory row */}
        <TouchableOpacity style={styles.addRow} onPress={openAddModal} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color="#000000" />
          <Text style={styles.addText}>{t('memorySettings.addMemory')}</Text>
        </TouchableOpacity>

        {/* ── DELETE ALL ── */}
        <View style={styles.deleteAllContainer}>
          <TouchableOpacity onPress={handleDeleteAll} activeOpacity={0.7}>
            <Text style={styles.deleteAllText}>{t('memorySettings.deleteAll.link')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── INFO ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('memorySettings.sections.info')}</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="information-circle-outline" size={20} color="#000000" />
          <Text style={styles.infoItemText}>{t('memorySettings.info.autoMemory')}</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="shield-outline" size={20} color="#000000" />
          <Text style={styles.infoItemText}>{t('memorySettings.info.gdpr')}</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── ADD / EDIT MODAL ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMemory
                  ? t('memorySettings.modal.editTitle')
                  : t('memorySettings.modal.addTitle')}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#000000" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('memorySettings.modal.placeholder')}
              placeholderTextColor="#adb5bd"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[
                styles.modalButton,
                (!inputText.trim() || savingModal) && styles.modalButtonDisabled,
              ]}
              onPress={handleSaveMemory}
              disabled={!inputText.trim() || savingModal}
              activeOpacity={0.7}
            >
              {savingModal ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalButtonText}>{t('common.buttons.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#495057',
    fontFamily: 'System',
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'System',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    fontFamily: 'System',
  },
  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 17,
    color: '#000000',
    fontWeight: '400',
    fontFamily: 'System',
    marginLeft: 15,
  },
  // Memory rows
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: -1,
  },
  memoryRowLast: {
    borderBottomWidth: 0,
  },
  memoryText: {
    flex: 1,
    fontSize: 15,
    color: '#212529',
    fontFamily: 'System',
    lineHeight: 22,
    marginRight: 12,
  },
  memoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  // Empty state
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  emptyText: {
    fontSize: 15,
    color: '#adb5bd',
    fontFamily: 'System',
    marginLeft: 10,
  },
  // Add row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addText: {
    fontSize: 17,
    color: '#000000',
    fontFamily: 'System',
    fontWeight: '400',
    marginLeft: 15,
  },
  // Delete all
  deleteAllContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    alignItems: 'center',
  },
  deleteAllText: {
    fontSize: 15,
    color: '#dc3545',
    fontFamily: 'System',
    textDecorationLine: 'underline',
  },
  // Info rows
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoItemText: {
    fontSize: 15,
    color: '#495057',
    marginLeft: 15,
    flex: 1,
    fontFamily: 'System',
    lineHeight: 20,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'System',
  },
  modalClose: {
    padding: 4,
  },
  modalInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'System',
    minHeight: 100,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
});
