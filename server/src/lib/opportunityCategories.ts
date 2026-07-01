export const CUSTOM_OPPORTUNITY_CATEGORY = "Custom";

// Adapted from the NCCS/IRS NTEE major-group taxonomy for volunteer-opportunity use.
const BASE_OPPORTUNITY_CATEGORY_OPTIONS = [
  "Arts & Culture",
  "Community Improvement",
  "Education",
  "Literacy & Libraries",
  "Tutoring & Mentoring",
  "STEM & Technology",
  "Environment",
  "Animal Welfare",
  "Food & Nutrition",
  "Agriculture & Community Gardens",
  "Health Care",
  "Mental Health & Crisis Support",
  "Medical Research & Disease Support",
  "Disability Support & Accessibility",
  "Seniors & Elder Care",
  "Housing & Shelter",
  "Homeless Services",
  "Human Services",
  "Youth Development",
  "Recreation & Sports",
  "Public Safety & Disaster Relief",
  "Civil Rights & Advocacy",
  "Legal Aid & Justice",
  "Employment & Workforce Development",
  "International Relief & Development",
  "Faith-Based Service",
  "Veterans & Military Families",
  "Philanthropy & Volunteerism",
  "Science & Research",
] as const;

export const OPPORTUNITY_CATEGORY_OPTIONS = [...BASE_OPPORTUNITY_CATEGORY_OPTIONS].sort((a, b) => a.localeCompare(b));

const CATEGORY_SET = new Set<string>(OPPORTUNITY_CATEGORY_OPTIONS);

export function isPredefinedOpportunityCategory(value: string): boolean {
  return CATEGORY_SET.has(value.trim());
}

export function resolveOpportunityCategory(
  category: string | null | undefined,
  customCategory: string | null | undefined,
): string | null {
  const normalizedCategory = category?.trim() || "";
  const normalizedCustom = customCategory?.trim() || "";

  if (!normalizedCategory) {
    return normalizedCustom || null;
  }

  if (normalizedCategory === CUSTOM_OPPORTUNITY_CATEGORY) {
    return normalizedCustom || null;
  }

  if (isPredefinedOpportunityCategory(normalizedCategory)) {
    return normalizedCategory;
  }

  // Backward-compatible fallback for older clients that may send the custom value directly.
  return normalizedCategory;
}
