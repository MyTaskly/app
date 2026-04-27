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
} from '../../services/revenueCatService';
import { PLANS, Plan } from '../../constants/planLimits';

export default function SubscriptionPlans() {
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
      if (plan.id === 'free') return; // Cannot buy free plan

      if (!plan.productId || !offerings) {
        Alert.alert(
          t('common.error', 'Errore'),
          t('subscriptionPlans.offlineError', 'Servizio offline o piano non disponibile.')
        );
        return;
      }

      try {
        setActionLoading(true);

        const packageToPurchase = offerings.current?.availablePackages.find(
          (pkg) => pkg.identifier === plan.productId
        );

        if (!packageToPurchase) {
          Alert.alert(t('subscriptionPlans.unavailable', 'Non disponibile al momento.'));
          return;
        }

        await RevenueCatService.getInstance().purchasePlan(packageToPurchase);
        await loadData();
        Alert.alert(t('subscriptionPlans.purchaseSuccess', 'Acquisto completato con successo!'));
      } catch (error: any) {
        if (error?.userCancelled) {
          return;
        }
        Alert.alert(
          t('subscriptionPlans.purchaseError', 'Errore durante l\'acquisto'),
          error?.message || t('common.error', 'Si è verificato un errore sconosciuto.')
        );
      } finally {
        setActionLoading(false);
      }
    },
    [offerings, t, loadData]
  );

  const handleCancel = useCallback(async () => {
    Alert.alert(
      t('subscriptionPlans.cancelConfirm', 'Annullare abbonamento?'),
      t('subscriptionPlans.cancelConfirmMessage', 'Sei sicuro di voler annullare? Manterrai i benefici fino alla scadenza del periodo attuale.'),
      [
        {
          text: t('common.cancel', 'Annulla'),
          style: 'cancel',
        },
        {
          text: t('common.confirm', 'Conferma'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await cancelSubscription();
              await loadData();
              Alert.alert(t('subscriptionPlans.cancelSuccess', 'Abbonamento annullato.'));
            } catch (error: any) {
              Alert.alert(
                t('subscriptionPlans.cancelError', 'Errore annullamento'),
                error?.message || t('common.error', 'Errore imprevisto.')
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
      Alert.alert(t('subscriptionPlans.restoreSuccess', 'Acquisti ripristinati correttamente.'));
    } catch (error: any) {
      Alert.alert(
        t('subscriptionPlans.restoreError', 'Errore ripristino'),
        error?.message || t('common.error', 'Si è verificato un errore.')
      );
    } finally {
      setActionLoading(false);
    }
  }, [t, loadData]);

  const isCurrentPlan = useCallback(
    (planId: string): boolean => {
      return planData?.effective_plan === planId;
    },
    [planData]
  );

  const renderPlanCard = (plan: Plan) => {
    const isCurrent = isCurrentPlan(plan.id);
    const isFree = plan.id === 'free';
    
    // Attempt to match local plan with RevenueCat package
    const pkg: PurchasesPackage | undefined = offerings?.current?.availablePackages.find(
      (p) => p.identifier === plan.productId
    );

    // Determine price and description
    let price = isFree ? t('common.free', 'Gratis') : '—';
    let description = t('subscriptionPlans.freeDescription', 'Piano di base.');
    
    if (!isFree) {
      if (pkg) {
        price = pkg.product.priceString;
        description = pkg.product.description;
      } else {
        description = t('subscriptionPlans.offlineDescription', 'Dettagli non disponibili al momento.');
      }
    }

    const offlineOrMissing = !isFree && !pkg;

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
          <View style={styles.planTitleContainer}>
            {!isFree && <Ionicons name="star" size={20} color={isCurrent ? "#007AFF" : "#FFD700"} style={{ marginRight: 6 }} />}
            <Text style={[styles.planName, isCurrent && styles.currentPlanName]}>
              {pkg?.product.title || plan.name}
            </Text>
          </View>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>
                {t('subscriptionPlans.currentPlan', 'Attuale')}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.planPrice}>
          {price}
          {!isFree && !offlineOrMissing && <Text style={styles.planDuration}> / {t('common.month', 'mese')}</Text>}
        </Text>
        <Text style={styles.planDescription}>{description}</Text>

        <View style={styles.features}>
          <FeatureRow
            label={t('subscriptionPlans.features.chatTextDaily', 'Chat testuali (Giorno)')}
            value={formatLimit(plan.limits.chatTextDaily)}
            unlimited={isUnlimitedPlan(plan.limits.chatTextDaily)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.chatTextMonthly', 'Chat testuali (Mese)')}
            value={formatLimit(plan.limits.chatTextMonthly)}
            unlimited={isUnlimitedPlan(plan.limits.chatTextMonthly)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.chatVoiceDaily', 'Chat vocali (Giorno)')}
            value={formatLimit(plan.limits.chatVoiceDaily)}
            unlimited={isUnlimitedPlan(plan.limits.chatVoiceDaily)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.chatVoiceMonthly', 'Chat vocali (Mese)')}
            value={formatLimit(plan.limits.chatVoiceMonthly)}
            unlimited={isUnlimitedPlan(plan.limits.chatVoiceMonthly)}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.aiModel', 'Modello AI')}
            value={plan.limits.aiModel}
            highlight={!isFree}
          />
          <FeatureRow
            label={t('subscriptionPlans.features.maxCategories', 'Categorie max')}
            value={formatLimit(plan.limits.maxCategories)}
            unlimited={isUnlimitedPlan(plan.limits.maxCategories)}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.upgradeButton,
            (isCurrent || actionLoading || offlineOrMissing) && styles.disabledButton,
            isCurrent && styles.currentButton
          ]}
          onPress={() => handlePurchase(plan)}
          disabled={isCurrent || actionLoading || offlineOrMissing || isFree}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={[
              styles.upgradeButtonText,
              (isCurrent || offlineOrMissing) && styles.disabledButtonText,
              isCurrent && styles.currentButtonText
            ]}>
              {isCurrent
                ? t('subscriptionPlans.currentPlan', 'Piano Attuale')
                : offlineOrMissing
                ? t('subscriptionPlans.unavailable', 'Non disponibile')
                : isFree
                ? t('subscriptionPlans.currentPlan', 'Piano Attuale')
                : t('subscriptionPlans.upgradeTo', { plan: plan.name })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderCancelSection = () => {
    if (!planData) return null;
    const canCancel = planData.status === 'active' && planData.effective_plan !== 'free';

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
              <View style={styles.actionButtonContent}>
                <Ionicons name="close-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.cancelButtonText}>
                  {t('subscriptionPlans.cancelSubscription', 'Annulla Abbonamento')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : planData.status === 'cancelled' && planData.current_period_end ? (
          <View style={styles.gracePeriodInfo}>
            <Ionicons name="information-circle" size={20} color="#856404" />
            <Text style={styles.gracePeriodText}>
              {t('subscriptionPlans.gracePeriod', 'I tuoi vantaggi scadranno il {{date}}', {
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
            <View style={styles.actionButtonContent}>
              <Ionicons name="refresh-outline" size={20} color="#007AFF" style={{ marginRight: 8 }} />
              <Text style={styles.restoreButtonText}>
                {t('subscriptionPlans.restorePurchases', 'Ripristina Acquisti')}
              </Text>
            </View>
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
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.description}>
          {t('subscriptionPlans.description', 'Scegli il piano migliore per le tue esigenze e sblocca il massimo del potenziale.')}
        </Text>

        {!loading && !offerings && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={22} color="#856404" />
            <Text style={styles.warningText}>
              {t('subscriptionPlans.offlineWarning', 'Connessione agli store fallita. Alcuni prezzi potrebbero non essere disponibili.')}
            </Text>
          </View>
        )}

        {Object.values(PLANS).map(renderPlanCard)}

        {renderCancelSection()}
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ label, value, unlimited, highlight }: {
  label: string;
  value: string | number;
  unlimited?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureLabelContainer}>
        <Ionicons name="checkmark-circle" size={18} color={highlight ? "#007AFF" : "#34C759"} style={{ marginRight: 8 }} />
        <Text style={styles.featureLabel}>{label}</Text>
      </View>
      <Text style={[styles.featureValue, highlight && styles.featureValueHighlight]}>
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
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
  },
  currentPlanCard: {
    borderColor: '#007AFF',
    backgroundColor: '#f8fcff',
  },
  freePlanCard: {
    borderColor: '#e1e5e9',
    shadowOpacity: 0.02,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  currentPlanName: {
    color: '#007AFF',
  },
  currentBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  currentBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  planDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8e8e93',
  },
  planDescription: {
    fontSize: 15,
    color: '#8e8e93',
    marginBottom: 24,
    lineHeight: 20,
  },
  features: {
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
  },
  featureLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  featureLabel: {
    fontSize: 15,
    color: '#3a3a3c',
    fontWeight: '500',
  },
  featureValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  featureValueHighlight: {
    color: '#007AFF',
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  currentButton: {
    backgroundColor: '#f2f2f7',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButton: {
    backgroundColor: '#e5e5ea',
    shadowOpacity: 0,
    elevation: 0,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  currentButtonText: {
    color: '#8e8e93',
  },
  disabledButtonText: {
    color: '#8e8e93',
  },
  actionsSection: {
    marginTop: 16,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#ff3b30',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  restoreButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d1d6',
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '700',
  },
  gracePeriodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  gracePeriodText: {
    fontSize: 15,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
    lineHeight: 20,
  },
});
