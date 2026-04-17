## ADDED Requirements

### Requirement: RevenueCat SDK initialized on first use
`revenueCatService.ts` SHALL initialize `Purchases` with the RevenueCat API key on first `getInstance()` call. Initialization SHALL be idempotent (safe to call multiple times).

#### Scenario: First initialization
- **WHEN** `RevenueCatService.getInstance()` is called for the first time
- **THEN** `Purchases.configure({ apiKey })` is called once with the Android public API key

#### Scenario: Re-initialization guard
- **WHEN** `getInstance()` is called a second time
- **THEN** `Purchases.configure()` is NOT called again

### Requirement: Offerings fetched from RevenueCat
The service SHALL expose `getOfferings()` returning the current RevenueCat offerings. SHALL return `null` (not throw) if fetch fails, so callers can handle offline gracefully.

#### Scenario: Offerings available
- **WHEN** `getOfferings()` is called and RevenueCat responds
- **THEN** the current offering object is returned

#### Scenario: Offerings fetch fails
- **WHEN** `getOfferings()` is called and network/SDK error occurs
- **THEN** `null` is returned (no uncaught exception)

### Requirement: Purchase flow via RevenueCat package
The service SHALL expose `purchasePlan(packageToPurchase)` that calls `Purchases.purchasePackage()` and returns the updated `CustomerInfo`. SHALL re-throw errors so the caller can distinguish user-cancelled from actual errors.

#### Scenario: Purchase completes
- **WHEN** `purchasePlan(pkg)` is called and user completes Play Store sheet
- **THEN** `CustomerInfo` is returned with updated entitlements

#### Scenario: Purchase user-cancelled
- **WHEN** user dismisses the Play Store sheet
- **THEN** a `PurchasesError` with `userCancelled = true` is thrown

### Requirement: Restore purchases
The service SHALL expose `restorePurchases()` that calls `Purchases.restorePurchases()` and returns updated `CustomerInfo`.

#### Scenario: Restore succeeds
- **WHEN** `restorePurchases()` is called and a prior receipt exists
- **THEN** updated `CustomerInfo` with entitlements is returned

#### Scenario: Restore finds nothing
- **WHEN** `restorePurchases()` is called with no prior receipt
- **THEN** `CustomerInfo` with empty entitlements is returned (no throw)

### Requirement: Product ID mapping
A constant map `PLAN_PRODUCT_IDS` SHALL map plan tier to Play Store product ID:
- `pro` → `"mytaskly_pro_monthly"`
- `premium` → `"mytaskly_premium_monthly"`

#### Scenario: Product ID lookup
- **WHEN** code needs the product ID for tier "pro"
- **THEN** `PLAN_PRODUCT_IDS["pro"]` returns `"mytaskly_pro_monthly"`
