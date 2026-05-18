type SchoolEntity = { id?: string | null; schoolId?: string | null; [key: string]: unknown };
type SchoolRef = SchoolEntity | null | undefined;
type CohortMembershipRef = { cohort?: SchoolRef } | null | undefined;

export function resolveEffectiveCohortFromUserAssociations<T extends {
  cohort?: SchoolRef;
  cohortMemberships?: CohortMembershipRef[];
}>(user: T | null | undefined): SchoolRef {
  if (!user) return null;
  return user.cohort ?? user.cohortMemberships?.[0]?.cohort ?? null;
}

export function resolveSchoolIdFromUserAssociations<T extends {
  schoolId?: string | null;
  school?: SchoolRef;
  classroom?: SchoolRef;
  cohort?: SchoolRef;
  cohortMemberships?: CohortMembershipRef[];
  createdSchools?: SchoolRef[];
}>(user: T | null | undefined): string | null {
  if (!user) return null;
  return (
    user.schoolId ??
    user.school?.id ??
    user.school?.schoolId ??
    user.classroom?.schoolId ??
    user.classroom?.id ??
    user.cohort?.schoolId ??
    user.cohort?.id ??
    user.cohortMemberships?.[0]?.cohort?.schoolId ??
    user.cohortMemberships?.[0]?.cohort?.id ??
    user.createdSchools?.[0]?.id ??
    user.createdSchools?.[0]?.schoolId ??
    null
  );
}

export function resolveSchoolFromUserAssociations<T extends {
  school?: SchoolRef;
  classroom?: { school?: SchoolRef } | null;
  cohort?: { school?: SchoolRef } | null;
  cohortMemberships?: Array<{ cohort?: { school?: SchoolRef } | null }>;
  createdSchools?: SchoolRef[];
}>(user: T | null | undefined): SchoolRef {
  if (!user) return null;
  return user.school
    ?? user.classroom?.school
    ?? user.cohort?.school
    ?? user.cohortMemberships?.[0]?.cohort?.school
    ?? user.createdSchools?.[0]
    ?? null;
}
