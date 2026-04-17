import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserPlan, isUnlimitedPlan, UserPlan } from '../../services/planService';

const AI_MODEL_KEY = 'ai_model_tier';
type ModelTier = 'base' | 'advanced';

export default function AISettings() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const [model, setModel] = useState<ModelTier>('base');

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
    AsyncStorage.getItem(AI_MODEL_KEY).then((val) => {
      if (val === 'advanced' || val === 'base') setModel(val);
    });
    loadPlan();
  }, [loadPlan]);

  // Se il piano è free e il modello era impostato su advanced, forza base
  useEffect(() => {
    if (!planData) return;
    if (planData.effective_plan.toLowerCase() === 'free' && model === 'advanced') {
      setModel('base');
      AsyncStorage.setItem(AI_MODEL_KEY, 'base');
      Alert.alert(
        'Modello avanzato non disponibile',
        'Il modello avanzato non è incluso nel piano Free. Hai impostato automaticamente il modello Base.',
        [{ text: 'OK' }]
      );
    }
  }, [planData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModelSelect = async (tier: ModelTier) => {
    if (tier === 'advanced' && planData?.effective_plan.toLowerCase() === 'free') {
      Alert.alert(
        'Modello non disponibile',
        'Il modello avanzato non è disponibile nel piano Free. Usa il modello Base oppure fai l\'upgrade.',
        [{ text: 'OK' }]
      );
      return;
    }
    setModel(tier);
    await AsyncStorage.setItem(AI_MODEL_KEY, tier);
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
        <View style={styles.planBadgeRow}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{planData.effective_plan.toUpperCase()}</Text>
          </View>
        </View>

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

        {planData.effective_plan.toLowerCase() === 'free' && (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => Alert.alert(t('planUsage.upgrade'), 'Coming soon!')}
          >
            <Text style={styles.upgradeButtonText}>{t('planUsage.upgrade')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── INTRO ── */}
        <View style={styles.introCard}>
          <Ionicons name="sparkles-outline" size={22} color="#000000" style={styles.introIcon} />
          <Text style={styles.introText}>{t('aiSettings.intro')}</Text>
        </View>

        {/* ── MODEL SELECTOR ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('aiSettings.sections.model')}</Text>
          <Text style={styles.sectionDesc}>{t('aiSettings.sections.modelDesc')}</Text>
        </View>

        {(['base', 'advanced'] as ModelTier[]).map((tier) => {
          const isSelected = model === tier;
          const isLocked = tier === 'advanced' && planData?.effective_plan.toLowerCase() === 'free';
          return (
            <TouchableOpacity
              key={tier}
              style={[styles.modelRow, isSelected && styles.modelRowSelected, isLocked && styles.modelRowLocked]}
              onPress={() => handleModelSelect(tier)}
              activeOpacity={isLocked ? 0.6 : 0.7}
            >
              <View style={styles.modelRowLeft}>
                <View style={[styles.radioDot, isSelected && styles.radioDotSelected, isLocked && styles.radioDotLocked]}>
                  {isSelected && !isLocked && <View style={styles.radioDotInner} />}
                </View>
                <View style={styles.modelTextWrap}>
                  <Text style={[styles.modelLabel, isSelected && styles.modelLabelSelected, isLocked && styles.modelLabelLocked]}>
                    {t(`aiSettings.model.${tier}.label`)}
                  </Text>
                  <Text style={[styles.modelDesc, isLocked && styles.modelDescLocked]}>
                    {t(`aiSettings.model.${tier}.desc`)}
                  </Text>
                </View>
              </View>
              {isLocked
                ? <Ionicons name="lock-closed-outline" size={18} color="#bbbbbb" />
                : isSelected && <Ionicons name="checkmark" size={20} color="#000000" />
              }
            </TouchableOpacity>
          );
        })}

        {/* ── USAGE ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('planUsage.sectionTitle')}</Text>
        </View>
        <View style={styles.planCardWrapper}>
          {renderPlanSection()}
        </View>

        {/* ── FEATURES ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('aiSettings.sections.features')}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('VoiceSettings')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="mic-outline" size={24} color="#000000" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>{t('aiSettings.menu.voice')}</Text>
              <Text style={styles.menuItemSubtitle}>{t('aiSettings.menu.voiceDesc')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('MemorySettings')}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="bookmark-outline" size={24} color="#000000" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>{t('aiSettings.menu.memory')}</Text>
              <Text style={styles.menuItemSubtitle}>{t('aiSettings.menu.memoryDesc')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666666" />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },

  // Intro
  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  introIcon: {
    marginRight: 12,
    marginTop: 1,
  },
  introText: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    fontFamily: 'System',
    lineHeight: 21,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'System',
    marginBottom: 3,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#6c757d',
    fontFamily: 'System',
    lineHeight: 18,
  },

  // Model selector
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modelRowSelected: {
    backgroundColor: '#f8f9fa',
  },
  modelRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#dee2e6',
    backgroundColor: '#ffffff',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDotSelected: {
    borderColor: '#000000',
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  modelTextWrap: {
    flex: 1,
  },
  modelLabel: {
    fontSize: 17,
    color: '#000000',
    fontFamily: 'System',
    fontWeight: '400',
  },
  modelLabelSelected: {
    fontWeight: '600',
  },
  modelRowLocked: {
    backgroundColor: '#fafafa',
  },
  radioDotLocked: {
    borderColor: '#cccccc',
    backgroundColor: '#f0f0f0',
  },
  modelLabelLocked: {
    color: '#aaaaaa',
  },
  modelDesc: {
    fontSize: 13,
    color: '#6c757d',
    fontFamily: 'System',
    marginTop: 2,
  },
  modelDescLocked: {
    color: '#cccccc',
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

  // Feature links
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
    marginLeft: 15,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 17,
    color: '#000000',
    fontFamily: 'System',
    fontWeight: '400',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#6c757d',
    fontFamily: 'System',
    marginTop: 2,
  },
});
