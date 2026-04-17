## 1. Dependencies & Constants

- [x] 1.1 Install `react-native-purchases` and run `npx expo install`
- [x] 1.2 Add RevenueCat plugin to `app.json` if required by the SDK
- [x] 1.3 Create `src/constants/planLimits.ts` with the plan limits table (free/pro/premium) and `PLAN_PRODUCT_IDS` map

## 2. RevenueCat Service

- [x] 2.1 Create `src/services/revenueCatService.ts` with singleton pattern
- [x] 2.2 Implement `configure(apiKey)` called once from `getInstance()`
- [x] 2.3 Implement `getOfferings(): Promise<Offerings | null>` — returns null on error
- [x] 2.4 Implement `purchasePlan(pkg: PurchasesPackage): Promise<CustomerInfo>` — re-throws on error
- [x] 2.5 Implement `restorePurchases(): Promise<CustomerInfo>`

## 3. Navigation

- [x] 3.1 Add `SubscriptionPlans: undefined` to `RootStackParamList` in `src/navigation/index.tsx`
- [x] 3.2 Register `SubscriptionPlans` screen in the Stack navigator

## 4. SubscriptionPlans Screen

- [x] 4.1 Create `src/navigation/screens/SubscriptionPlans.tsx` scaffold (SafeAreaView, ScrollView, header)
- [x] 4.2 Fetch current user plan (`getUserPlan`) and RevenueCat offerings on mount
- [x] 4.3 Render three plan cards (Free, Pro, Premium) with hardcoded limits from `planLimits.ts`
- [x] 4.4 Display live price from RevenueCat package; show "—" if offering unavailable
- [x] 4.5 Highlight current plan card; disable its purchase button with "Current plan" label
- [x] 4.6 Implement purchase button handler: call `purchasePlan()`, refresh plan on success, show alert on error
- [x] 4.7 Handle user-cancelled purchase (no error shown)
- [x] 4.8 Add "Cancel subscription" button for `status = active`; show `current_period_end` for `status = cancelled`
- [x] 4.9 Implement cancel flow: confirmation dialog → `cancelSubscription()` → refresh plan state
- [x] 4.10 Add "Restore purchases" button → `restorePurchases()` → success/no-purchases-found alert
- [x] 4.11 Add loading state during purchase / restore / cancel operations
- [x] 4.12 Add offline/unavailable state: purchase buttons disabled with "Unavailable" label

## 5. Wire Upgrade Buttons

- [x] 5.1 In `Settings.tsx`: replace upgrade `Alert.alert('Coming soon!')` with `navigation.navigate('SubscriptionPlans')`
- [x] 5.2 In `AISettings.tsx`: same replacement for upgrade button

## 6. Localization

- [x] 6.1 Add all new strings to `src/locales/en.json` under `subscriptionPlans` namespace
- [x] 6.2 Add Italian translations to `src/locales/it.json`
