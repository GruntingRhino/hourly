export type BeneficiaryAdminRole = "OWNER" | "ADMIN" | null;

export function roleForBeneficiaryClaim(hasOwner: boolean): Exclude<BeneficiaryAdminRole, null> {
  return hasOwner ? "ADMIN" : "OWNER";
}

export function canRemoveBeneficiaryAdmin(input: {
  targetRole: BeneficiaryAdminRole | null | undefined;
  ownerCount: number;
  targetUserId: string;
  actorUserId: string;
}): boolean {
  if (input.targetRole === "OWNER" && input.ownerCount <= 1) return false;
  return true;
}
