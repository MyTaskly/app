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
        <View style={[styles.premiumCard, styles.premiumCardFree]}>
          <ActivityIndicator size="small" color="#1C1C1E" />
          <Text style={styles.planLoadingText}>{t('planUsage.loading', 'Caricamento...')}</Text>
        </View>
      );
    }

    if (planError || !planData) {
      return (
        <TouchableOpacity style={[styles.premiumCard, styles.premiumCardFree]} onPress={loadPlan}>
          <Text style={styles.planErrorText}>{t('planUsage.error', 'Errore di caricamento. Riprova.')}</Text>
        </TouchableOpacity>
      );
    }

    const isFree = planData.effective_plan.toLowerCase() === 'free';
    const textUnlimited = isUnlimitedPlan(planData.chat_text_daily_limit);
    const voiceUnlimited = isUnlimitedPlan(planData.chat_voice_monthly_limit);

    return (
      <View style={[styles.premiumCard, isFree ? styles.premiumCardFree : styles.premiumCardActive]}>
        <View style={styles.premiumCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!isFree && <Ionicons name="star" size={18} color="#FFD700" style={{ marginRight: 8 }} />}
            <Text style={[styles.premiumPlanName, !isFree && styles.textWhite]}>
              {planData.effective_plan.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.activeBadge, !isFree && styles.activeBadgeDark]}>
            <Ionicons name="checkmark" size={12} color={!isFree ? "#1C1C1E" : "#007AFF"} />
            <Text style={[styles.activeBadgeText, !isFree && styles.activeBadgeTextDark]}>
              {t('settings.plan.active', 'Active')}
            </Text>
          </View>
        </View>

        <View style={styles.usageContainer}>
          <View style={styles.usageItem}>
            <Text style={[styles.usageLabel, !isFree && styles.textGrayLight]}>
              {t('planUsage.dailyMessages', 'Chat testuali (Giorno)')}
            </Text>
            <Text style={[styles.usageValue, !isFree && styles.textWhite]}>
              {textUnlimited ? '∞' : String(planData.chat_text_daily_limit)}
            </Text>
          </View>
          <View style={styles.usageDivider} />
          <View style={styles.usageItem}>
            <Text style={[styles.usageLabel, !isFree && styles.textGrayLight]}>
              {t('planUsage.voiceRequests', 'Chat vocali (Mese)')}
            </Text>
            <Text style={[styles.usageValue, !isFree && styles.textWhite]}>
              {voiceUnlimited ? '∞' : String(planData.chat_voice_monthly_limit)}
            </Text>
          </View>
        </View>

        {isFree && (
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate('SubscriptionPlans')}
          >
            <Text style={styles.upgradeBtnText}>{t('planUsage.upgrade', 'Upgrade to Premium')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'bottom', 'left']}>
      <StatusBar style="dark" />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        
        {/* Plan & Usage Section (MOVED TO TOP) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('planUsage.sectionTitle', 'Plan & Usage')}</Text>
        </View>
        <View style={styles.planCardWrapper}>
          {renderPlanSection()}
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('SubscriptionPlans')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="card-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>{t('settings.menu.pricing', 'Pricing & Plans')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

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
          onPress={() => navigation.navigate('NotificationDebug')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="bug-outline" size={24} color="#000000" />
            <Text style={styles.menuItemText}>Debug Notifiche</Text>
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
  scrollContent: {
    paddingBottom: 40,
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
  
  // Premium Plan Card styles
  planCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  premiumCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 8,
  },
  premiumCardFree: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  premiumCardActive: {
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  premiumCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  premiumPlanName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textGrayLight: {
    color: '#A1A1A6',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeDark: {
    backgroundColor: '#FFFFFF',
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    marginLeft: 4,
  },
  activeBadgeTextDark: {
    color: '#1C1C1E',
  },
  usageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  usageItem: {
    flex: 1,
  },
  usageLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
    fontWeight: '500',
  },
  usageValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  usageDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    marginHorizontal: 16,
  },
  upgradeBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  planLoadingText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#8E8E93',
    fontWeight: '500',
  },
  planErrorText: {
    textAlign: 'center',
    color: '#FF3B30',
    fontWeight: '500',
    paddingVertical: 10,
  }
});
