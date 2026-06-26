// Centralized billing configuration. Never import from client code.
// Prices are in cents to avoid floating-point issues.

export const BILLING_CONFIG = {
  organization: {
    proMonthlyPriceCents: 3000,  // $30/month
    proAnnualPriceCents: 30000,  // $300/year
    stripeMonthlyPriceId: process.env.STRIPE_ORG_PRO_MONTHLY_PRICE_ID ?? "",
    stripeAnnualPriceId: process.env.STRIPE_ORG_PRO_ANNUAL_PRICE_ID ?? "",
  },
  school: {
    pricePerStudentCents: parseInt(process.env.SCHOOL_PRICE_PER_STUDENT_CENTS ?? "50", 10),
    annualMinimumCents: parseInt(process.env.SCHOOL_ANNUAL_MINIMUM_CENTS ?? "50000", 10),
  },
} as const;

export function calculateSchoolEstimate(enrollment: number): number {
  const { pricePerStudentCents, annualMinimumCents } = BILLING_CONFIG.school;
  return Math.max(enrollment * pricePerStudentCents, annualMinimumCents);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
