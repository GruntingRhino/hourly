export type BeneficiaryAdminRole = "OWNER" | "ADMIN";

export function canRemoveBeneficiaryAdmin(input: {
  targetRole: BeneficiaryAdminRole | null | undefined;
  ownerCount: number;
  targetUserId: string;
  actorUserId: string;
}): boolean {
  if (input.targetRole === "OWNER" && input.ownerCount <= 1) return false;
  return true;
}
