import { Text } from '@react-navigation/elements';
import React from 'react';
import { StyleSheet, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../../services/axiosInstance';
import { useTranslation } from 'react-i18next';
import { useTutorialContext } from '../../contexts/TutorialContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_STORAGE_KEY } from '../../constants/tutorialContent';

export default function Settings() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { startTutorial } = useTutorialContext();

  const handleNavigateToAccountSettings = () => {
    navigation.navigate('AccountSettings');
  };

  const handleNavigateToChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleNavigateToHelp = () => {
    navigation.navigate('Help');
  };

  const handleNavigateToAbout = () => {
    navigation.navigate('About');
  };

  const handleNavigateToLanguage = () => {
    navigation.navigate('Language');
  };

  const handleNavigateToVoiceSettings = () => {
    navigation.navigate('VoiceSettings');
  };

  const handleNavigateToGoogleCalendar = () => {
    navigation.navigate('GoogleCalendar');
  };

  const handleNavigateToNotificationSettings = () => {
    navigation.navigate('NotificationSettings');
  };

  const handleNavigateToMemorySettings = () => {
    navigation.navigate('MemorySettings');
  };

  const handleNavigateToCalendarWidgetDemo = () => {
    navigation.navigate('CalendarWidgetDemo');
  };

  const handleRestartTutorial = async () => {
    try {
      // Remove tutorial completion flag to allow restart
      await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
      
      // Start the tutorial
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

  const testNotification = async () => {
    try {
      const response = await axiosInstance.post('api/notifications/test-timer-notification', {
        title: "Test Timer",
        body: "Notifica di test in arrivo",
        delay_seconds: 10
      });

      console.log('Timer avviato:', response.data.estimated_arrival);

    } catch (error) {
      console.error('Errore test:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.account')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToAccountSettings}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="person-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.manageAccount')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToChangePassword}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="key-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.changePassword')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        {/* Support Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.support')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToHelp}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="help-circle-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.help')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        {/* General Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.general')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToLanguage}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="language-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.language')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToVoiceSettings}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="mic-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.voiceSettings')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToGoogleCalendar}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="calendar-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.googleCalendar')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToNotificationSettings}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="notifications-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.notificationSettings')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToMemorySettings}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="bookmark-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.memorySettings')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleNavigateToAbout}
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

        {/* Development Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('settings.sections.development')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={testNotification}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="notifications-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.testNotifications')}</Text>
          </View>
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
