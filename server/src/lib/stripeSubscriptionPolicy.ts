type SubscriptionEntitlement = {
  planTier: "FREE" | "PRO";
  subscriptionStatus: string;
};

type SubscriptionEntitlementEvent =
  | { event: "updated"; stripeStatus: string; cancelAtPeriodEnd: boolean }
  | { event: "deleted" };

const SUBSCRIPTION_STATUS_MAP: Record<string, string> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELLED",
  unpaid: "PAST_DUE",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELLED",
  paused: "PAST_DUE",
};

export function projectSubscriptionEntitlement(input: SubscriptionEntitlementEvent): SubscriptionEntitlement {
  if (input.event === "deleted") {
    return { planTier: "FREE", subscriptionStatus: "CANCELLED" };
  }

  const subscriptionStatus = SUBSCRIPTION_STATUS_MAP[input.stripeStatus] ?? "ACTIVE";
  if (input.cancelAtPeriodEnd) {
    return { planTier: "PRO", subscriptionStatus: "CANCEL_AT_PERIOD_END" };
  }

  const keepsPro = ["ACTIVE", "TRIALING", "PAST_DUE"].includes(subscriptionStatus);
  return { planTier: keepsPro ? "PRO" : "FREE", subscriptionStatus };
}
