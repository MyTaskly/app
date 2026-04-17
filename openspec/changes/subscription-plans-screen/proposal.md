## Why

MyTaskly needs a revenue stream. The backend already enforces plan limits (categories, AI model, daily/monthly chat quotas) but users have no way to upgrade — the app lacks a paywall, plan comparison, and purchase flow. Play Store IAP via RevenueCat is already chosen as the payment provider; this change wires the client end.

## What Changes

- New **SubscriptionPlans** screen showing Free / Pro / Premium plan cards with feature comparison
- RevenueCat SDK (`react-native-purchases`) integrated for Play Store product fetch and purchase
- Purchase flow: tap upgrade → Google Play sheet → confirm → subscription active
- Cancel subscription UI via `POST /billing/cancel` (already implemented in `planService.ts`)
- Plan limits shown per card using the table below (hardcoded as fallback if RevenueCat offline):

| Feature | Free | Pro | Premium |
|---|---|---|---|
| Chat text — daily | 20 | 50 | ∞ |
| Chat text — monthly | 130 | 250 | 400 |
| Chat voice — daily | ∞ | ∞ | ∞ |
| Chat voice — monthly | 20 | 50 | 150 |
| AI model | base | advanced | advanced |
| Categories | max 5 | ∞ | ∞ |

- Navigation entry point: "View plan" button already present in Settings and AISettings
- Localization: IT + EN

## Capabilities

### New Capabilities

- `subscription-plans-screen`: Dedicated screen for plan comparison and purchase via RevenueCat/Play Store
- `revenuecat-integration`: RevenueCat SDK setup, product fetch, purchase and restore flows

### Modified Capabilities

- `plan-display`: Settings and AISettings currently show plan badge + limits inline; the "Upgrade" button now navigates to SubscriptionPlans instead of showing "Coming soon!"

## Impact

- New dependency: `react-native-purchases` (RevenueCat SDK)
- New screen: `src/navigation/screens/SubscriptionPlans.tsx`
- New service: `src/services/revenueCatService.ts`
- Navigation: `RootStackParamList` gains `SubscriptionPlans` entry
- `Settings.tsx` and `AISettings.tsx`: upgrade button wired to navigation
- `planService.ts`: already has `cancelSubscription()` — no new API calls needed
- `app.json`: may need RevenueCat plugin entry
- No backend changes needed — plan activation is handled server-side via RevenueCat webhook (already implemented)
