## ADDED Requirements

### Requirement: Screen shows plan comparison cards
The screen SHALL display three plan cards (Free, Pro, Premium) each showing: plan name, price (from RevenueCat or "—" if unavailable), and the feature comparison table (daily text messages, monthly text messages, monthly voice messages, AI model, max categories).

#### Scenario: Plans rendered on open
- **WHEN** user navigates to SubscriptionPlans
- **THEN** three cards are visible: Free, Pro, Premium with feature rows matching the plan limits table

#### Scenario: Current plan highlighted
- **WHEN** the user's `effective_plan` is "pro"
- **THEN** the Pro card is visually marked as "Current plan" and its purchase button is disabled

### Requirement: User can purchase a paid plan
The screen SHALL allow users to initiate a Play Store subscription purchase by tapping the upgrade button on a Pro or Premium card.

#### Scenario: Successful purchase
- **WHEN** user taps "Upgrade to Pro" and completes the Google Play purchase sheet
- **THEN** `getUserPlan()` is called to refresh plan state and a success message is shown

#### Scenario: Purchase cancelled by user
- **WHEN** user dismisses the Google Play purchase sheet
- **THEN** no error is shown and the screen remains in its previous state

#### Scenario: Purchase error
- **WHEN** the purchase fails (network error, billing unavailable)
- **THEN** an alert is shown with the error message and the purchase button re-enables

### Requirement: User can cancel active subscription
The screen SHALL show a "Cancel subscription" option for users with `status = active` or `status = cancelled` (still in grace period).

#### Scenario: Cancel initiated
- **WHEN** user taps "Cancel subscription" and confirms the confirmation dialog
- **THEN** `cancelSubscription()` is called; on success the plan card updates to show `status = cancelled` with `current_period_end`

#### Scenario: Cancel on already-cancelled plan
- **WHEN** user has `status = cancelled`
- **THEN** "Cancel subscription" button is hidden; grace period end date is shown instead

### Requirement: User can restore purchases
The screen SHALL include a "Restore purchases" button that re-validates existing Play Store receipts.

#### Scenario: Restore with valid receipt
- **WHEN** user taps "Restore purchases" and has an active Play Store subscription
- **THEN** subscription is re-activated, plan refreshed, success message shown

#### Scenario: Restore with no receipt
- **WHEN** user taps "Restore purchases" and has no prior purchase
- **THEN** alert shown: "No purchases found to restore"

### Requirement: Offline / unavailable state
When RevenueCat offerings cannot be fetched, the screen SHALL still display the plan cards with hardcoded feature limits but without prices, and purchase buttons SHALL be disabled with label "Unavailable".

#### Scenario: RevenueCat offline
- **WHEN** `getOfferings()` throws or returns null
- **THEN** plan cards render without prices; purchase buttons show "Unavailable" and are non-tappable
