## Context

MyTaskly has three subscription tiers (free / pro / premium) enforced server-side. RevenueCat is the chosen payment provider and already handles backend webhook events (`POST /billing/webhook`). The client currently has no purchase UI — upgrade buttons show "Coming soon!". `planService.ts` already exposes `getUserPlan()` and `cancelSubscription()`. The `UserSubscription` type already includes all limit fields.

Current navigation stack (`RootStackParamList`) has no `SubscriptionPlans` entry. Settings and AISettings both have an upgrade `TouchableOpacity` that shows an alert.

## Goals / Non-Goals

**Goals:**
- Add `SubscriptionPlans` screen: plan cards with feature comparison + Play Store purchase via RevenueCat
- Wire "Upgrade plan" buttons in Settings and AISettings to navigate to the new screen
- Fetch live prices from RevenueCat; fall back to hardcoded plan data if offline
- Handle purchase, restore, and cancel flows

**Non-Goals:**
- iOS App Store support (Android/Play Store only in this change)
- Web payment or Stripe integration
- Admin plan override UI
- Custom paywall analytics beyond what RevenueCat provides by default

## Decisions

### D1: RevenueCat SDK (`react-native-purchases`)
**Choice**: Use the official `react-native-purchases` package.  
**Why**: RevenueCat is already the backend payment provider. The SDK handles Play Store product fetch, purchase sheet, receipt validation, and restore — all with a single `Purchases.purchasePackage()` call. Alternative (raw Google Play Billing) requires far more code and manual receipt validation.

### D2: New service `revenueCatService.ts`
**Choice**: Encapsulate all RevenueCat SDK calls in `src/services/revenueCatService.ts`.  
**Why**: Keeps the screen thin; testable in isolation; consistent with the project's service layer pattern (singleton + lazy init). The screen only calls `getOfferings()`, `purchasePlan()`, `restorePurchases()`.

### D3: Plan limits as static constants, not fetched from API
**Choice**: Hardcode plan limits in `src/constants/planLimits.ts` mirroring the table in the proposal.  
**Why**: The limits are part of the app's value proposition copy — they change rarely and need to be displayed even when offline. `getUserPlan()` provides the *user's current* limits at runtime; the paywall shows the *offered* limits for comparison.

### D4: `SubscriptionPlans` as a stack screen (not modal/tab)
**Choice**: Add `SubscriptionPlans: undefined` to `RootStackParamList`, navigated via `navigation.navigate('SubscriptionPlans')`.  
**Why**: Consistent with the existing navigation pattern (Settings, AISettings, etc.). Modal presentation would require a separate stack; stack screen reuses the existing navigator.

### D5: RevenueCat product IDs
**Choice**: Map plan tiers to Play Store product IDs via a constant map:
```
pro     → "mytaskly_pro_monthly"
premium → "mytaskly_premium_monthly"
```
These must match the product IDs configured in Google Play Console and RevenueCat dashboard.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| RevenueCat SDK not initialized before screen opens | Initialize in `revenueCatService.ts` `getInstance()` call; catch and surface error in UI |
| Play Store products not configured → empty offerings | Show hardcoded plan cards without price; disable purchase button with "Unavailable" label |
| User purchases but server webhook delayed → plan still shows free | After purchase success, call `getUserPlan()` to refresh and show optimistic "Processing..." state |
| `react-native-purchases` requires native build (no Expo Go support) | App already uses `expo-dev-client`; native build required anyway |
| Cancel flow: `cancelSubscription()` cancels server-side but Play Store auto-renews until period end | Show grace period info (`current_period_end`) in UI after cancel |
