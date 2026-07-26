// Centralized billing configuration. Never import from client code.
// Prices are in cents to avoid floating-point issues.

export const DEFAULT_ORGANIZATION_QUOTE_INTERVAL = "annual" as const;

export const BILLING_CONFIG = {
  organization: {
    proMonthlyPriceCents: 3000,  // $30/month
    proAnnualPriceCents: 30000,  // $300/year
    stripeMonthlyPriceId: process.env.STRIPE_ORG_PRO_MONTHLY_PRICE_ID ?? "",
    stripeAnnualPriceId: process.env.STRIPE_ORG_PRO_ANNUAL_PRICE_ID ?? "",
  },
  school: {
    introductoryPricePerStudentCents: parseInt(process.env.SCHOOL_PRICE_PER_STUDENT_CENTS ?? "50", 10),
    standardPricePerStudentCents: parseInt(process.env.SCHOOL_STANDARD_PRICE_PER_STUDENT_CENTS ?? "100", 10),
    priceIncreaseEffectiveAt: process.env.SCHOOL_PRICE_INCREASE_EFFECTIVE_AT
      ? new Date(process.env.SCHOOL_PRICE_INCREASE_EFFECTIVE_AT)
      : null,
  },
} as const;

export type SchoolPricing = typeof BILLING_CONFIG.school;

/**
 * The configured effective date makes the introductory-to-standard price change
 * an operations setting rather than a code deployment.
 */
export function getSchoolPricePerStudentCents(now = new Date(), pricing: SchoolPricing = BILLING_CONFIG.school): number {
  const effectiveAt = pricing.priceIncreaseEffectiveAt;
  return effectiveAt && !Number.isNaN(effectiveAt.getTime()) && now >= effectiveAt
    ? pricing.standardPricePerStudentCents
    : pricing.introductoryPricePerStudentCents;
}

export function calculateSchoolEstimate(
  enrollment: number,
  now = new Date(),
  pricing: SchoolPricing = BILLING_CONFIG.school,
): number {
  return enrollment * getSchoolPricePerStudentCents(now, pricing);
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  const formatted = dollars % 1 === 0
    ? dollars.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : dollars.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${formatted}`;
}
