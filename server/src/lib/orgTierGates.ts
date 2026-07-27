// ─── Tier feature flags ──────────────────────────────────────────

export const ORGANIZATION_TIER_LIMITS = {
  FREE: {
    storageLimitBytes: 350 * 1024 * 1024,     // 350 MB
    uploadAttemptsPerHour: 50,
    configurableReminders: false,
    customEmailBranding: false,
    automatedFormReminders: false,
    advancedReminderContent: false,
    advancedWaitlistControls: false,
    attendanceAnalytics: false,
    priorityListing: false,
    multiAdminManagement: false,
  },
  PRO: {
    storageLimitBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    uploadAttemptsPerHour: 100,
    configurableReminders: true,
    customEmailBranding: true,
    automatedFormReminders: true,
    advancedReminderContent: true,
    advancedWaitlistControls: true,
    attendanceAnalytics: true,
    priorityListing: true,
    multiAdminManagement: true,
  },
} as const;

export type OrgTier = "FREE" | "PRO";
export type OrgFeature = keyof (typeof ORGANIZATION_TIER_LIMITS)["FREE"];

// Default reminder schedules stored in OrgReminderConfig.reminders
export const DEFAULT_FREE_REMINDERS = [
  { minutesBefore: 1440, enabled: true, label: "24 hours before" },
];
export const DEFAULT_PRO_REMINDERS = [
  { minutesBefore: 2880, enabled: true, label: "48 hours before" },
  { minutesBefore: 180,  enabled: true, label: "3 hours before" },
];

// ─── Structured error ────────────────────────────────────────────

export class ForbiddenFeatureError extends Error {
  readonly code = "PRO_FEATURE_REQUIRED";
  constructor(
    public readonly feature: OrgFeature,
    public readonly userMessage: string
  ) {
    super(userMessage);
    this.name = "ForbiddenFeatureError";
  }
}

const FEATURE_MESSAGES: Record<OrgFeature, string> = {
  configurableReminders: "Upgrade to GoodHours Pro to configure multiple reminders.",
  customEmailBranding: "Upgrade to GoodHours Pro to add your logo and brand colors to emails.",
  automatedFormReminders: "Upgrade to GoodHours Pro for automated required-form follow-ups.",
  advancedReminderContent: "Upgrade to GoodHours Pro to include directions, prep notes, and contact info in reminders.",
  advancedWaitlistControls: "Upgrade to GoodHours Pro for configurable waitlist promotion controls.",
  attendanceAnalytics: "Upgrade to GoodHours Pro to access attendance and reminder analytics.",
  priorityListing: "Upgrade to GoodHours Pro for featured opportunity placement.",
  multiAdminManagement: "Upgrade to GoodHours Pro to invite additional organization administrators.",
  storageLimitBytes: "Storage limit is set by your plan tier.",
  uploadAttemptsPerHour: "Upload rate is set by your plan tier.",
};

// ─── Helpers ────────────────────────────────────────────────────

export async function getOrgTier(beneficiaryId: string): Promise<OrgTier> {
  const { default: prisma } = await import("./prisma");
  const { resolveBeneficiaryPlanTier } = await import("./schoolBeneficiaryPolicy");
  const ben = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { planTier: true, createdBySchoolId: true, visibility: true, hasSchoolComplimentaryPro: true },
  });
  if (!ben) return "FREE";
  const persistedTier = ben.planTier === "PRO" ? "PRO" : "FREE";
  return resolveBeneficiaryPlanTier(ben, persistedTier);
}

export function getOrgTierLimits(tier: OrgTier) {
  return ORGANIZATION_TIER_LIMITS[tier];
}

export async function hasOrgFeature(beneficiaryId: string, feature: OrgFeature): Promise<boolean> {
  const tier = await getOrgTier(beneficiaryId);
  return Boolean(ORGANIZATION_TIER_LIMITS[tier][feature]);
}

export async function requireOrgFeature(beneficiaryId: string, feature: OrgFeature): Promise<void> {
  const has = await hasOrgFeature(beneficiaryId, feature);
  if (!has) {
    throw new ForbiddenFeatureError(feature, FEATURE_MESSAGES[feature]);
  }
}

// Used in Express route handlers — returns a 403 response and throws to abort the handler.
export function sendForbiddenFeature(
  res: { status: (c: number) => { json: (b: object) => void } },
  err: ForbiddenFeatureError
): void {
  res.status(403).json({
    error: err.userMessage,
    code: err.code,
    feature: err.feature,
  });
}
