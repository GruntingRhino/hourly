-- Restore the grace-period entitlement for subscriptions that were projected as
-- PAST_DUE before projectSubscriptionEntitlement preserved Pro access.
-- Only Stripe-backed rows are eligible; customer.subscription.deleted remains
-- the event that clears the subscription id and removes Pro.
UPDATE "Beneficiary"
SET "planTier" = 'PRO'
WHERE "subscriptionStatus" = 'PAST_DUE'
  AND "stripeSubscriptionId" IS NOT NULL
  AND "planTier" = 'FREE';
