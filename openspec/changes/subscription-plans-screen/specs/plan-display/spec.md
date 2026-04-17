## MODIFIED Requirements

### Requirement: Upgrade button navigates to SubscriptionPlans
In Settings and AISettings, the "Upgrade plan" button for free users SHALL navigate to the `SubscriptionPlans` screen instead of showing a "Coming soon!" alert.

#### Scenario: Free user taps upgrade in Settings
- **WHEN** user with `effective_plan = "free"` taps the upgrade button in Settings
- **THEN** `navigation.navigate('SubscriptionPlans')` is called

#### Scenario: Free user taps upgrade in AISettings
- **WHEN** user with `effective_plan = "free"` taps the upgrade button in AISettings
- **THEN** `navigation.navigate('SubscriptionPlans')` is called

#### Scenario: Non-free user sees no upgrade button
- **WHEN** user has `effective_plan != "free"`
- **THEN** the upgrade button is not rendered in Settings or AISettings plan card
