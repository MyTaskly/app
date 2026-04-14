import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RecurringTask, recurringTaskService } from '../../services/recurringTaskService';
import RecurringTaskCard from '../../components/Task/RecurringTaskCard';
import CreateRecurringTaskModal from '../../components/Task/CreateRecurringTaskModal';

const RecurringTasksScreen: React.FC = () => {
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const isMounted = useRef(true);

  const fetchTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await recurringTaskService.listRecurringTasks({ activeOnly });
      if (isMounted.current) setTasks(data);
    } catch (err: any) {
      if (isMounted.current) {
        setError(err?.response?.data?.detail || err?.message || 'Errore nel caricamento');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeOnly]);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      fetchTasks();
      return () => { isMounted.current = false; };
    }, [fetchTasks])
  );

  const handleUpdate = (updated: RecurringTask) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleCardPress = (task: RecurringTask) => {
    setEditingTaskId(task.id);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingTaskId(null);
  };

  const handleModalSaved = () => {
    handleModalClose();
    fetchTasks();
  };

  const renderItem = ({ item }: { item: RecurringTask }) => (
    <RecurringTaskCard
      task={item}
      onUpdate={handleUpdate}
      onPress={handleCardPress}
    />
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="repeat-outline" size={52} color="#ccc" />
        <Text style={styles.emptyTitle}>Nessun task ricorrente</Text>
        <Text style={styles.emptySubtitle}>
          {activeOnly
            ? 'Nessun task attivo. Disattiva il filtro per vederne altri.'
            : 'Crea il tuo primo task ricorrente con il pulsante +'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header controls */}
      <View style={styles.header}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Solo attivi</Text>
          <Switch
            value={activeOnly}
            onValueChange={val => {
              setActiveOnly(val);
              fetchTasks();
            }}
            trackColor={{ false: '#e1e5e9', true: '#007AFF' }}
            thumbColor="#fff"
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditingTaskId(null);
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchTasks()}>
            <Text style={styles.errorRetry}>Riprova</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, tasks.length === 0 && styles.listEmpty]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTasks(true)}
              tintColor="#007AFF"
            />
          }
        />
      )}

      <CreateRecurringTaskModal
        visible={modalVisible}
        taskId={editingTaskId}
        onClose={handleModalClose}
        onSaved={handleModalSaved}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
  },
  addBtn: {
    backgroundColor: '#000000',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '200',
    color: '#333',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFCCCC',
  },
  errorText: {
    fontSize: 13,
    color: '#CC0000',
    flex: 1,
  },
  errorRetry: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 12,
  },
});

export default RecurringTasksScreen;
