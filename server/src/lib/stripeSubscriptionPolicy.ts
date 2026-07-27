type SubscriptionEntitlement = {
  planTier: "FREE" | "PRO";
  subscriptionStatus: string;
};

export function hasExactApprovedProPrice(
  items: Array<{ priceId: string; quantity: number | null | undefined }>,
  approvedPriceIds: ReadonlySet<string>,
): boolean {
  return items.length === 1
    && items[0].quantity === 1
    && approvedPriceIds.has(items[0].priceId);
}

type SubscriptionEntitlementEvent =
  | {
      event: "created" | "updated" | "checkout_completed";
      stripeStatus: string;
      cancelAtPeriodEnd: boolean;
      permanentPro?: boolean;
      currentPlanTier?: "FREE" | "PRO";
    }
  | { event: "deleted"; permanentPro?: boolean };

type SubscriptionEventOrderingInput = {
  event: "created" | "checkout_completed" | "updated" | "deleted";
  incomingSubscriptionId: string;
  incomingEventCreatedAt?: Date;
  currentSubscriptionId: string | null;
  currentSubscriptionStatus: string;
  currentEventCreatedAt?: Date | null;
};

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
    return { planTier: input.permanentPro ? "PRO" : "FREE", subscriptionStatus: "CANCELLED" };
  }

  const subscriptionStatus = SUBSCRIPTION_STATUS_MAP[input.stripeStatus] ?? "INCOMPLETE";
  const paidStatus = ["active", "trialing", "past_due", "unpaid", "paused"].includes(input.stripeStatus);
  const preservesExistingPro = input.currentPlanTier === "PRO";
  if (input.cancelAtPeriodEnd && (input.permanentPro || paidStatus || input.currentPlanTier === "PRO")) {
    return { planTier: "PRO", subscriptionStatus: "CANCEL_AT_PERIOD_END" };
  }

  // Only deletion revokes an existing paid entitlement. Non-deletion lifecycle
  // events preserve existing Pro but can never grant Pro to a previously Free row.
  const keepsPro = paidStatus || preservesExistingPro;
  return { planTier: input.permanentPro || keepsPro ? "PRO" : "FREE", subscriptionStatus };
}

/** Prevent delayed events for an old subscription from overwriting a newer or
 * already-deleted lifecycle. */
export function shouldApplySubscriptionEvent(input: SubscriptionEventOrderingInput): boolean {
  if (
    input.incomingEventCreatedAt
    && input.currentEventCreatedAt
    && input.incomingEventCreatedAt < input.currentEventCreatedAt
  ) {
    return false;
  }
  if (input.currentSubscriptionId && input.currentSubscriptionId !== input.incomingSubscriptionId) {
    const opensNewLifecycle = input.event === "created" || input.event === "checkout_completed";
    if (!opensNewLifecycle) return false;
    if (input.incomingEventCreatedAt && input.currentEventCreatedAt) {
      return input.incomingEventCreatedAt > input.currentEventCreatedAt;
    }
    return false;
  }
  if (
    input.event !== "created"
    && !input.currentSubscriptionId
    && input.currentSubscriptionStatus === "CANCELLED"
  ) {
    return Boolean(
      input.incomingEventCreatedAt
      && input.currentEventCreatedAt
      && input.incomingEventCreatedAt > input.currentEventCreatedAt,
    );
  }
  return true;
}
