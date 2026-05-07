// Adapted from the NCCS/IRS NTEE major-group taxonomy for volunteer-opportunity use.
export const OPPORTUNITY_CATEGORY_OPTIONS = [
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

export function isPredefinedOpportunityCategory(value: string): boolean {
  return OPPORTUNITY_CATEGORY_OPTIONS.includes(value as (typeof OPPORTUNITY_CATEGORY_OPTIONS)[number]);
}

export function splitOpportunityCategory(category: string | null | undefined): {
  selectedCategory: string;
  customCategory: string;
} {
  const normalized = category?.trim() || "";
  if (!normalized) {
    return { selectedCategory: "", customCategory: "" };
  }
  if (isPredefinedOpportunityCategory(normalized)) {
    return { selectedCategory: normalized, customCategory: "" };
  }
  return { selectedCategory: normalized, customCategory: normalized };
}

export function buildOpportunityCategoryOptions(extraValues: Array<string | null | undefined> = []): string[] {
  const extras = extraValues
    .map((value) => value?.trim() || "")
    .filter((value) => value && !isPredefinedOpportunityCategory(value));
  return [...OPPORTUNITY_CATEGORY_OPTIONS, ...Array.from(new Set(extras)).sort((a, b) => a.localeCompare(b))];
}
