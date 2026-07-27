export type WaitlistPromotionPolicyInput = {
  tier: "FREE" | "PRO";
  disableAutoPromotion: boolean;
  requireApprovalForPromotion: boolean;
  waitlistCutoffHours: number | null;
  eventStartsAt: Date;
  now: Date;
};

export function shouldAutoPromoteWaitlist(input: WaitlistPromotionPolicyInput): boolean {
  // Persisted Pro configuration is retained on downgrade, but cannot affect Free behavior.
  if (input.tier === "FREE") return true;
  if (input.disableAutoPromotion || input.requireApprovalForPromotion) return false;
  if (input.waitlistCutoffHours == null) return true;
  const hoursUntilStart = (input.eventStartsAt.getTime() - input.now.getTime()) / (60 * 60 * 1000);
  return hoursUntilStart > input.waitlistCutoffHours;
}
