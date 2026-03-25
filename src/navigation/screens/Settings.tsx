import { Text } from '@react-navigation/elements';
import React from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTutorialContext } from '../../contexts/TutorialContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_STORAGE_KEY } from '../../constants/tutorialContent';

export default function Settings() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { startTutorial } = useTutorialContext();

  const handleRestartTutorial = async () => {
    try {
      await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
      startTutorial();
    } catch (error) {
      console.error('[Settings] Error restarting tutorial:', error);
      Alert.alert(
        t('settings.tutorial.restartError'),
        t('settings.tutorial.restartErrorMessage'),
        [{ text: t('common.buttons.ok') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.account')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('AccountSettings')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="person-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.manageAccount')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        {/* AI Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.ai')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('AISettings')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="sparkles-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.aiSettings')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        {/* General Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.general')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Language')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="language-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.language')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('GoogleCalendar')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="calendar-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.googleCalendar')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('NotificationSettings')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="notifications-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.notificationSettings')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        {/* App Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.app')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('About')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="information-circle-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.about')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleRestartTutorial}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="book-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.tutorial')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 15,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    padding: 8,
    marginRight: 15,
  },
  title: {
    fontSize: 30,
    fontWeight: '200',
    color: '#000000',
    fontFamily: 'System',
    letterSpacing: -1.5,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: 17,
    color: '#000000',
    fontFamily: 'System',
    fontWeight: '400',
    marginLeft: 15,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'System',
  },
});
