import { Text } from '@react-navigation/elements';
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTutorialContext } from '../../contexts/TutorialContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_STORAGE_KEY } from '../../constants/tutorialContent';
import { getUserPlan, isUnlimitedPlan, UserPlan } from '../../services/planService';
import { STORAGE_KEYS } from '../../constants/authConstants';
import axiosInstance from '../../services/axiosInstance';
import { getValidToken } from '../../services/authService';

export default function Settings() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { startTutorial } = useTutorialContext();

  // Plan & Usage state
  const [planData, setPlanData] = useState<UserPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      setPlanLoading(true);
      setPlanError(false);
      const data = await getUserPlan();
      setPlanData(data);
    } catch {
      setPlanError(true);
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

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

  const handleTestNotification = async () => {
    try {
      const token = await getValidToken();
      const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
      if (!token || !userId) {
        Alert.alert('Errore', 'Utente non autenticato');
        return;
      }
      const scheduledAt = new Date(Date.now() + 60_000).toISOString();
      await axiosInstance.post('/notifications/test-notification', {
        user_id: parseInt(userId, 10),
        title: 'Test notifica',
        body: 'Se ricevi questo messaggio, le notifiche funzionano!',
        scheduled_at: scheduledAt,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Ok', 'Notifica programmata tra 1 minuto');
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Invio fallito');
    }
  };

  const renderPlanSection = () => {
    if (planLoading) {
      return (
        <View style={styles.planCard}>
          <ActivityIndicator size="small" color="#000000" />
          <Text style={styles.planLoadingText}>{t('planUsage.loading')}</Text>
        </View>
      );
    }

    if (planError || !planData) {
      return (
        <TouchableOpacity style={styles.planCard} onPress={loadPlan}>
          <Text style={styles.planErrorText}>{t('planUsage.error')}</Text>
        </TouchableOpacity>
      );
    }

    const textUnlimited = isUnlimitedPlan(planData.chat_text_daily_limit);

    return (
      <View style={styles.planCard}>
        {/* Plan badge */}
        <View style={styles.planBadgeRow}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{planData.effective_plan.toUpperCase()}</Text>
          </View>
        </View>

        {/* Daily text messages */}
        <View style={styles.usageRow}>
          <View style={styles.usageLabelRow}>
            <Text style={styles.usageLabel}>{t('planUsage.dailyMessages')}</Text>
            <Text style={styles.usageCount}>
              {textUnlimited
                ? t('planUsage.unlimited')
                : String(planData.chat_text_daily_limit)}
            </Text>
          </View>
        </View>

        {/* Voice access */}
        <View style={styles.usageRow}>
          <View style={styles.usageLabelRow}>
            <Text style={styles.usageLabel}>{t('planUsage.voiceRequests')}</Text>
            <Text style={styles.usageCount}>
              {planData.chat_voice_monthly_limit === null
                ? t('planUsage.unlimited')
                : String(planData.chat_voice_monthly_limit)}
            </Text>
          </View>
        </View>

        {/* Upgrade CTA for FREE */}
        {planData.effective_plan.toLowerCase() === 'free' && (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => navigation.navigate('SubscriptionPlans')}
          >
            <Text style={styles.upgradeButtonText}>{t('planUsage.upgrade')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'bottom', 'left']}>
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

        {/* Plan & Usage Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('planUsage.sectionTitle')}</Text>
        </View>
        <View style={styles.planCardWrapper}>
          {renderPlanSection()}
        </View>

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
          onPress={() => navigation.navigate('RecurringTasks')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="repeat-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>Task ricorrenti</Text>
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
          onPress={handleTestNotification}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="notifications-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>Test notifica</Text>
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
  // Plan & Usage card
  planCardWrapper: {
    paddingHorizontal: 20,
  },
  planCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  planLoadingText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'System',
    marginTop: 8,
    textAlign: 'center',
  },
  planErrorText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'System',
    textAlign: 'center',
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planBadge: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
    letterSpacing: 0.5,
  },
  resetDateText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'System',
  },
  usageRow: {
    marginBottom: 12,
  },
  usageLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  usageLabel: {
    fontSize: 14,
    color: '#333333',
    fontFamily: 'System',
    fontWeight: '400',
  },
  usageCount: {
    fontSize: 14,
    color: '#333333',
    fontFamily: 'System',
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#e1e5e9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#000000',
    borderRadius: 3,
  },
  progressBarWarning: {
    backgroundColor: '#FF6B35',
  },
  upgradeButton: {
    marginTop: 12,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
});
