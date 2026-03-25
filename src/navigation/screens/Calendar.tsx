import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CalendarView from '../../components/Calendar/CalendarView';
import Calendar20View from '../../components/Calendar20/Calendar20View';
import { useTranslation } from 'react-i18next';

const CALENDAR_VIEW_MODE_KEY = '@calendar_view_mode';

export default function Calendar() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'minimal' | 'advanced'>('minimal');
  const [isLoading, setIsLoading] = useState(true);

  // Carica la preferenza salvata all'avvio
  useEffect(() => {
    loadViewMode();
  }, []);

  const loadViewMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(CALENDAR_VIEW_MODE_KEY);
      if (savedMode === 'advanced' || savedMode === 'minimal') {
        setViewMode(savedMode);
      }
    } catch (error) {
      console.error('Error loading calendar view mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleViewMode = async () => {
    const newMode = viewMode === 'minimal' ? 'advanced' : 'minimal';
    setViewMode(newMode);
    try {
      await AsyncStorage.setItem(CALENDAR_VIEW_MODE_KEY, newMode);
    } catch (error) {
      console.error('Error saving calendar view mode:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header con titolo principale e toggle button */}
      <View style={styles.header}>
        <Text style={styles.mainTitle}>{t('calendar.title')}</Text>
        <TouchableOpacity
            onPress={toggleViewMode}
            style={styles.toggleButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={viewMode === 'minimal' ? 'grid-outline' : 'calendar-clear-outline'}
              size={24}
              color="#000000"
            />
          </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {viewMode === 'minimal' ? <CalendarView /> : <Calendar20View />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 4,
    paddingHorizontal: 15,
    paddingBottom: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  mainTitle: {
    paddingTop: 2,
    fontSize: 30,
    fontWeight: "200", // Stesso peso di Home20
    color: "#000000",
    textAlign: "left",
    fontFamily: "System",
    letterSpacing: -1.5,
    marginBottom: 0,
    flex: 1,
  },
  toggleButton: {
    paddingTop: 15,
    paddingLeft: 15,
    paddingRight: 5,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
});