export type BeneficiaryVisibility = "PUBLIC" | "PRIVATE";
export type BeneficiaryPlanTier = "FREE" | "PRO";

export type SchoolBeneficiaryIdentity = {
  createdBySchoolId?: string | null;
  visibility?: string | null;
  hasSchoolComplimentaryPro?: boolean;
};

export function isPermanentSchoolPro(identity: SchoolBeneficiaryIdentity): boolean {
  return identity.hasSchoolComplimentaryPro === true
    || (Boolean(identity.createdBySchoolId) && identity.visibility === "PRIVATE");
}

export function schoolCreatedBeneficiaryPlan(visibility: BeneficiaryVisibility) {
  return visibility === "PRIVATE"
    ? { planTier: "PRO" as const, hasSchoolComplimentaryPro: true }
    : { planTier: "FREE" as const };
}

export function resolveBeneficiaryPlanTier(
  identity: SchoolBeneficiaryIdentity,
  projectedTier: BeneficiaryPlanTier,
): BeneficiaryPlanTier {
  return isPermanentSchoolPro(identity) ? "PRO" : projectedTier;
}
