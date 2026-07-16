export type LegacyOpportunityForAvailability = {
  id: string;
  title: string;
  description: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number;
  organization: {
    id: string;
    name: string;
  };
  confirmedSignupCount: number;
};

/**
 * Adapts a legacy Organization opportunity to the slot shape used by the
 * student browse API. Legacy organizations remain usable while their records
 * are migrated to the Beneficiary model.
 */
export function toLegacyAvailableSlot(opportunity: LegacyOpportunityForAvailability) {
  return {
    id: `legacy:${opportunity.id}`,
    legacyOpportunityId: opportunity.id,
    date: opportunity.date,
    startTime: opportunity.startTime,
    endTime: opportunity.endTime,
    durationHours: opportunity.durationHours,
    capacity: opportunity.capacity,
    _count: { signups: opportunity.confirmedSignupCount },
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      description: opportunity.description,
      location: null,
      category: null,
      requirementsNote: null,
      beneficiary: {
        id: opportunity.organization.id,
        name: opportunity.organization.name,
        category: null,
        planTier: null,
      },
    },
  };
}
