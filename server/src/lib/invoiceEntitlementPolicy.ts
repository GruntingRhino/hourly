import type { PrismaClient } from "@prisma/client";

type InvoiceEntitlementState = {
  subscriptionStatus: string;
  currentPeriodEnd: Date | null;
  stripeSubscriptionId: string | null;
  hasSchoolComplimentaryPro: boolean;
};

export function getInvoiceEntitlementPeriodEnd(
  activatedAt: Date,
  interval: "monthly" | "annual",
): Date {
  const periodEnd = new Date(activatedAt);
  if (interval === "annual") {
    const originalMonth = periodEnd.getUTCMonth();
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
    if (periodEnd.getUTCMonth() !== originalMonth) periodEnd.setUTCDate(0);
    return periodEnd;
  }

  const originalDay = periodEnd.getUTCDate();
  periodEnd.setUTCDate(1);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(
    periodEnd.getUTCFullYear(),
    periodEnd.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  periodEnd.setUTCDate(Math.min(originalDay, lastDay));
  return periodEnd;
}

export function shouldExpireInvoiceEntitlement(
  state: InvoiceEntitlementState,
  now = new Date(),
): boolean {
  return state.subscriptionStatus === "INVOICE_ACTIVE"
    && state.currentPeriodEnd !== null
    && state.currentPeriodEnd <= now
    && state.stripeSubscriptionId === null
    && !state.hasSchoolComplimentaryPro;
}

export async function expireInvoiceEntitlements(
  prisma: PrismaClient,
  now = new Date(),
): Promise<number> {
  const result = await prisma.beneficiary.updateMany({
    where: {
      subscriptionStatus: "INVOICE_ACTIVE",
      currentPeriodEnd: { lte: now },
      stripeSubscriptionId: null,
      hasSchoolComplimentaryPro: false,
    },
    data: {
      planTier: "FREE",
      subscriptionStatus: "INVOICE_EXPIRED",
      currentPeriodEnd: null,
      billingInterval: null,
      cancelAtPeriodEnd: false,
    },
  });
  return result.count;
}
