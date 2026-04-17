import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getUserPlan,
  cancelSubscription,
  UserSubscription,
  isUnlimitedPlan,
} from '../../services/planService';
import RevenueCatService, {
  type Offerings,
  type PurchasesPackage,
  type CustomerInfo,
} from '../../services/revenueCatService';
import { PLANS, PLAN_PRODUCT_IDS, Plan } from '../../constants/planLimits';

export default function SubscriptionPlans() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();

  const [planData, setPlanData] = useState<UserSubscription | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [userPlan, rcOfferings] = await Promise.all([
        getUserPlan(),
        RevenueCatService.getInstance().getOfferings(),
      ]);
      setPlanData(userPlan);
      setOfferings(rcOfferings);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = useCallback(
    async (plan: Plan) => {
      if (!plan.productId || !offerings) return;

      try {
        setActionLoading(true);

        const packageToPurchase = offerings.current
          .availablePackages[0]
          .packages.find((pkg) => pkg.identifier === plan.productId);

        if (!packageToPurchase) {
          Alert.alert(t('subscriptionPlans.unavailable'));
          return;
        }

        await RevenueCatService.getInstance().purchasePlan(packageToPurchase);
        await loadData();
        Alert.alert(t('subscriptionPlans.purchaseSuccess'));
      } catch (error: any) {
        if (error?.userCancelled) {
          return;
        }
        Alert.alert(
          t('subscriptionPlans.purchaseError'),
          error?.message || t('common.error')
        );
      } finally {
        setActionLoading(false);
      }
    },
    [offerings, t, loadData]
  );

  const handleCancel = useCallback(async () => {
    Alert.alert(
      t('subscriptionPlans.cancelConfirm'),
      t('subscriptionPlans.cancelConfirmMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await cancelSubscription();
              await loadData();
              Alert.alert(t('subscriptionPlans.cancelSuccess'));
            } catch (error: any) {
              Alert.alert(
                t('subscriptionPlans.cancelError'),
                error?.message || t('common.error')
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [t, loadData]);

  const handleRestore = useCallback(async () => {
    try {
      setActionLoading(true);
      await RevenueCatService.getInstance().restorePurchases();
      await loadData();
      Alert.alert(t('subscriptionPlans.restoreSuccess'));
    } catch (error: any) {
      Alert.alert(
        t('subscriptionPlans.restoreError'),
        error?.message || t('common.error')
      );
    } finally {
      setActionLoading(false);
    }
  }, [t, loadData]);

  const getPackagePrice = useCallback(
    (plan: Plan): string => {
      if (!offerings || !plan.productId) return '—';

      const pkg = offerings.current.availablePackages[0].packages.find(
        (p) => p.identifier === plan.productId
      );
      return pkg?.product.priceString || '—';
    },
    [offerings]
  );

  const isCurrentPlan = useCallback(
    (planId: string): boolean => {
      return planData?.effective_plan === planId;
    },
    [planData]
  );

  const renderPlanCard = (plan: Plan) => {
    const isCurrent = isCurrentPlan(plan.id);
    const price = getPackagePrice(plan);
    const unavailable = !offerings && plan.productId;
    const isFree = plan.id === 'free';

    return (
      <View
        key={plan.id}
        style={[
          styles.planCard,
          isCurrent && styles.currentPlanCard,
          isFree && styles.freePlanCard,
        ]}
      >
        <View style={styles.planHeader}>
          <Text style={[styles.planName, isCurrent && styles.currentPlanName]}>
            {plan.name}
          </Text>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>
                {t('subscriptionPlans.currentPlan')}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.planPrice}>{price}</Text>

        <View style={styles.features}>
          <FeatureRow
            label={t('subscriptionPlans.features.chatTextDaily')}
            value={formatLimit(plan.limits.chatTextDaily)}
            unlimited={isUnlimitedPlan(plan.limits.chatTextDaily)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.chatTextMonthly')}
            value={formatLimit(plan.limits.chatTextMonthly)}
            unlimited={isUnlimitedPlan(plan.limits.chatTextMonthly)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.chatVoiceDaily')}
            value={formatLimit(plan.limits.chatVoiceDaily)}
            unlimited={isUnlimitedPlan(plan.limits.chatVoiceDaily)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.chatVoiceMonthly')}
            value={formatLimit(plan.limits.chatVoiceMonthly)}
            unlimited={isUnlimitedPlan(plan.limits.chatVoiceMonthly)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.aiModel')}
            value={plan.limits.aiModel}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.maxCategories')}
            value={formatLimit(plan.limits.maxCategories)}
            unlimited={isUnlimitedPlan(plan.limits.maxCategories)}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.upgradeButton,
            (isCurrent || unavailable || actionLoading) && styles.disabledButton,
          ]}
          onPress={() => handlePurchase(plan)}
          disabled={isCurrent || unavailable || actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.upgradeButtonText}>
              {isCurrent
                ? t('subscriptionPlans.currentPlan')
                : unavailable
                ? t('subscriptionPlans.unavailable')
                : isFree
                ? t('subscriptionPlans.currentPlan')
                : t('subscriptionPlans.upgradeTo', { plan: plan.name })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderCancelSection = () => {
    if (!planData) return null;
    const canCancel = planData.status === 'active';

    return (
      <View style={styles.actionsSection}>
        {canCancel ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancel}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.cancelButtonText}>
                {t('subscriptionPlans.cancelSubscription')}
              </Text>
            )}
          </TouchableOpacity>
        ) : planData.status === 'cancelled' && planData.current_period_end ? (
          <View style={styles.gracePeriodInfo}>
            <Ionicons name="information-circle" size={20} color="#666666" />
            <Text style={styles.gracePeriodText}>
              {t('subscriptionPlans.gracePeriod', {
                date: new Date(planData.current_period_end).toLocaleDateString(),
              })}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.actionButton, styles.restoreButton]}
          onPress={handleRestore}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.restoreButtonText}>
              {t('subscriptionPlans.restorePurchases')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('navigation.screens.subscriptionPlans')}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.description}>
          {t('subscriptionPlans.description')}
        </Text>

        {Object.values(PLANS).map(renderPlanCard)}

        {renderCancelSection()}
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ label, value, unlimited }: {
  label: string;
  value: string | number;
  unlimited?: boolean;
}) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureLabel}>{label}</Text>
      <Text style={styles.featureValue}>
        {unlimited ? '∞' : value}
      </Text>
    </View>
  );
}

function formatLimit(limit: number | string): string | number {
  if (typeof limit === 'string') return limit;
  if (limit === Infinity) return '∞';
  return limit;
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e1e5e9',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  currentPlanCard: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  freePlanCard: {
    borderColor: '#e1e5e9',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  currentPlanName: {
    color: '#007AFF',
  },
  currentBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 20,
  },
  features: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  featureLabel: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  featureValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  upgradeButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#e1e5e9',
    shadowOpacity: 0,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsSection: {
    marginTop: 24,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#ff3b30',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  gracePeriodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  gracePeriodText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
    flex: 1,
  },
});
