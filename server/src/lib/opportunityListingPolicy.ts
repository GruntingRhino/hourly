import { resolveBeneficiaryPlanTier } from "./schoolBeneficiaryPolicy";

type AvailableSlotForRanking = {
  date: Date | string;
  startTime: string;
  opportunity?: {
    beneficiary?: {
      planTier?: string;
      createdBySchoolId?: string | null;
      visibility?: string;
    } | null;
  } | null;
};

function hasPriorityListing(slot: AvailableSlotForRanking): boolean {
  const beneficiary = slot.opportunity?.beneficiary;
  if (!beneficiary) return false;
  const tier = resolveBeneficiaryPlanTier(
    {
      createdBySchoolId: beneficiary.createdBySchoolId ?? null,
      visibility: beneficiary.visibility ?? "PUBLIC",
    },
    beneficiary.planTier === "PRO" ? "PRO" : "FREE",
  );
  return tier === "PRO";
}

/**
 * Preserve chronological relevance. Pro is only a tie-breaker when date and
 * start time are equal, matching the advertised small placement boost.
 */
export function compareAvailableSlots(a: AvailableSlotForRanking, b: AvailableSlotForRanking): number {
  const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (dateDifference) return dateDifference;
  const timeDifference = a.startTime.localeCompare(b.startTime);
  if (timeDifference) return timeDifference;
  return Number(hasPriorityListing(b)) - Number(hasPriorityListing(a));
}
