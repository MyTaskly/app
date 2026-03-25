import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_MODEL_KEY = 'ai_model_tier';
type ModelTier = 'base' | 'advanced';

// Demo usage data
const USAGE_USED = 348;
const USAGE_LIMIT = 500;
const USAGE_RATIO = USAGE_USED / USAGE_LIMIT;

export default function AISettings() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const [model, setModel] = useState<ModelTier>('base');
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(AI_MODEL_KEY).then((val) => {
      if (val === 'advanced' || val === 'base') setModel(val);
    });
    Animated.timing(barAnim, {
      toValue: USAGE_RATIO,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, []);

  const handleModelSelect = async (tier: ModelTier) => {
    setModel(tier);
    await AsyncStorage.setItem(AI_MODEL_KEY, tier);
  };

  const barColor = USAGE_RATIO > 0.85 ? '#dc3545' : USAGE_RATIO > 0.6 ? '#f4a322' : '#000000';

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
          return (
            <TouchableOpacity
              key={tier}
              style={[styles.modelRow, isSelected && styles.modelRowSelected]}
              onPress={() => handleModelSelect(tier)}
              activeOpacity={0.7}
            >
              <View style={styles.modelRowLeft}>
                <View style={[styles.radioDot, isSelected && styles.radioDotSelected]}>
                  {isSelected && <View style={styles.radioDotInner} />}
                </View>
                <View style={styles.modelTextWrap}>
                  <Text style={[styles.modelLabel, isSelected && styles.modelLabelSelected]}>
                    {t(`aiSettings.model.${tier}.label`)}
                  </Text>
                  <Text style={styles.modelDesc}>{t(`aiSettings.model.${tier}.desc`)}</Text>
                </View>
              </View>
              {isSelected && <Ionicons name="checkmark" size={20} color="#000000" />}
            </TouchableOpacity>
          );
        })}

        {/* ── USAGE ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('aiSettings.sections.usage')}</Text>
          <Text style={styles.sectionDesc}>{t('aiSettings.sections.usageDesc')}</Text>
        </View>

        <View style={styles.usageCard}>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>{t('aiSettings.usage.messages')}</Text>
            <Text style={styles.usageCount}>
              <Text style={styles.usageUsed}>{USAGE_USED}</Text>
              <Text style={styles.usageOf}> / {USAGE_LIMIT}</Text>
            </Text>
          </View>

          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  width: barAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: barColor,
                },
              ]}
            />
          </View>

          <Text style={styles.usageHint}>
            {t('aiSettings.usage.remaining', { n: USAGE_LIMIT - USAGE_USED })}
          </Text>
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
  modelDesc: {
    fontSize: 13,
    color: '#6c757d',
    fontFamily: 'System',
    marginTop: 2,
  },

  // Usage card
  usageCard: {
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  usageLabel: {
    fontSize: 14,
    color: '#495057',
    fontFamily: 'System',
    fontWeight: '500',
  },
  usageCount: {
    fontSize: 14,
    fontFamily: 'System',
  },
  usageUsed: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'System',
  },
  usageOf: {
    fontSize: 14,
    color: '#6c757d',
    fontFamily: 'System',
  },
  barTrack: {
    height: 6,
    backgroundColor: '#dee2e6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageHint: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'System',
    marginTop: 8,
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
