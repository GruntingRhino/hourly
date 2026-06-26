import prisma from "./prisma";
import { getOrgTier, ORGANIZATION_TIER_LIMITS, DEFAULT_FREE_REMINDERS, DEFAULT_PRO_REMINDERS } from "./orgTierGates";
import { sendEventReminderEmail } from "../services/email";
import { generateICS, slotDateTime } from "./icsGenerator";

// Scheduler fires every 15 min. We look ahead LOOK_AHEAD_MS + guard buffer to
// ensure no slot falls in a gap between runs.
const INTERVAL_MS = 15 * 60 * 1000;
const LOOK_AHEAD_BUFFER_MS = 2 * 60 * 1000; // 2 min buffer per side

interface ReminderDefinition {
  minutesBefore: number;
  enabled: boolean;
  label: string;
}

function parseReminders(raw: string | null | undefined): ReminderDefinition[] {
  if (!raw) return DEFAULT_FREE_REMINDERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }
  return DEFAULT_FREE_REMINDERS;
}

interface ReminderSignup {
  id: string;
  studentId: string;
  cancellationToken: string | null;
  slot: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    opportunity: {
      id: string;
      title: string;
      location: string | null;
      address: string | null;
      beneficiaryId: string;
      preparationNotes: string | null;
      arrivalInstructions: string | null;
      contactInfo: string | null;
      requiredFormUrl: string | null;
      requiredFormName: string | null;
      requiredFormIsRequired: boolean;
      beneficiary: {
        planTier: string;
        brandColor: string | null;
        logoUrl: string | null;
        emailSignature: string | null;
        name: string;
        reminderConfig: { reminders: string } | null;
      };
    };
  };
  student: { email: string; name: string };
}

async function processReminder(
  signup: ReminderSignup,
  minutesBefore: number,
  tier: "FREE" | "PRO"
): Promise<void> {
  const reminderType = tier === "FREE"
    ? "FREE_24H"
    : `PRO_CUSTOM_${minutesBefore}`;

  // Idempotency: skip if already sent or in progress
  const existing = await prisma.orgEventReminderLog.findUnique({
    where: { signupId_reminderType: { signupId: signup.id, reminderType } },
  });
  if (existing && existing.deliveryStatus !== "FAILED") return;

  // Create or update the log record (PENDING → we own this slot)
  const log = existing
    ? await prisma.orgEventReminderLog.update({
        where: { id: existing.id },
        data: { deliveryStatus: "PENDING", failureReason: null },
      })
    : await prisma.orgEventReminderLog.create({
        data: {
          signupId: signup.id,
          beneficiaryId: signup.slot.opportunity.beneficiaryId,
          opportunityId: signup.slot.opportunity.id,
          reminderType,
          scheduledFor: new Date(slotDateTime(signup.slot.date, signup.slot.startTime).getTime() - minutesBefore * 60 * 1000),
          deliveryStatus: "PENDING",
        },
      });

  const opp = signup.slot.opportunity;
  const ben = opp.beneficiary;
  const tierLimits = ORGANIZATION_TIER_LIMITS[tier];

  const startDt = slotDateTime(signup.slot.date, signup.slot.startTime);
  const endDt = slotDateTime(signup.slot.date, signup.slot.endTime);

  const icsContent = generateICS({
    uid: `${signup.id}-${minutesBefore}`,
    title: opp.title,
    startUtc: startDt,
    endUtc: endDt,
    location: opp.address ?? opp.location ?? undefined,
    description: opp.preparationNotes ?? undefined,
    organizerName: ben.name,
  });

  const eventDate = signup.slot.date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  try {
    await sendEventReminderEmail({
      to: signup.student.email,
      eventName: opp.title,
      eventDate,
      startTime: signup.slot.startTime,
      endTime: signup.slot.endTime,
      location: opp.location ?? "See event details",
      address: opp.address ?? undefined,
      cancellationToken: signup.cancellationToken ?? undefined,
      icsContent,
      // Pro-only content
      ...(tierLimits.advancedReminderContent ? {
        preparationNotes: opp.preparationNotes ?? undefined,
        arrivalInstructions: opp.arrivalInstructions ?? undefined,
        contactInfo: opp.contactInfo ?? undefined,
        customMessage: undefined,
      } : {}),
      ...(tierLimits.automatedFormReminders && opp.requiredFormUrl ? {
        requiredFormUrl: opp.requiredFormUrl,
        requiredFormName: opp.requiredFormName ?? "Required form",
      } : {}),
      ...(tierLimits.customEmailBranding ? {
        brandColor: ben.brandColor ?? undefined,
        orgLogoUrl: ben.logoUrl ?? undefined,
        emailSignature: ben.emailSignature ?? undefined,
        orgName: ben.name,
      } : { orgName: ben.name }),
    });

    await prisma.orgEventReminderLog.update({
      where: { id: log.id },
      data: { deliveryStatus: "SENT", sentAt: new Date() },
    });
  } catch (err) {
    await prisma.orgEventReminderLog.update({
      where: { id: log.id },
      data: {
        deliveryStatus: "FAILED",
        failureReason: String((err as any)?.message ?? err).slice(0, 500),
      },
    });
    throw err;
  }
}

async function runEventReminderCycle(): Promise<void> {
  const now = Date.now();

  // Get all unique reminder windows we need to check this cycle.
  // We process each beneficiary's configured reminder offsets.

  // Fetch all configs + Pro orgs
  const configs = await prisma.orgReminderConfig.findMany({
    include: { beneficiary: { select: { id: true, planTier: true } } },
  });

  // Build a map of beneficiaryId → reminders to send
  const tierMap = new Map<string, { tier: "FREE" | "PRO"; reminders: ReminderDefinition[] }>();

  for (const config of configs) {
    const tier: "FREE" | "PRO" = config.beneficiary.planTier === "PRO" ? "PRO" : "FREE";
    const reminders = parseReminders(config.reminders);
    tierMap.set(config.beneficiaryId, { tier, reminders });
  }

  // Also include orgs that have no config yet (they get the default 24h Free reminder)
  // We'll handle them generically below.

  // For each unique minutesBefore window, find signups within that window
  // across all orgs. De-dupe by signupId+type inside processReminder.

  // Collect all unique minutesBefore values we need to check
  const windowMinutes = new Set<number>([1440]); // always check 24h (Free default)
  for (const { reminders } of tierMap.values()) {
    for (const r of reminders) {
      if (r.enabled) windowMinutes.add(r.minutesBefore);
    }
  }

  for (const minutes of windowMinutes) {
    const targetMs = now + minutes * 60 * 1000;
    const windowStart = new Date(targetMs - INTERVAL_MS / 2 - LOOK_AHEAD_BUFFER_MS);
    const windowEnd   = new Date(targetMs + INTERVAL_MS / 2 + LOOK_AHEAD_BUFFER_MS);

    // Find slots that start within this window
    const slots = await prisma.beneficiaryTimeSlot.findMany({
      where: {
        date: { gte: windowStart, lte: windowEnd },
        opportunity: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    if (slots.length === 0) continue;

    const slotIds = slots.map((s) => s.id);

    // Find confirmed signups for those slots
    const signups = await prisma.beneficiarySignup.findMany({
      where: { slotId: { in: slotIds }, status: "CONFIRMED" },
      include: {
        slot: {
          include: {
            opportunity: {
              include: {
                beneficiary: {
                  select: {
                    id: true, planTier: true, name: true,
                    brandColor: true, logoUrl: true, emailSignature: true,
                    reminderConfig: { select: { reminders: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (signups.length === 0) continue;

    // Fetch students separately (no direct relation on BeneficiarySignup)
    const studentIds = [...new Set(signups.map((s) => s.studentId))];
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, email: true, name: true },
    });
    const studentMap = new Map(students.map((u) => [u.id, u]));

    for (const signup of signups) {
      const student = studentMap.get(signup.studentId);
      if (!student) continue;

      const ben = signup.slot.opportunity.beneficiary;
      const tier: "FREE" | "PRO" = ben.planTier === "PRO" ? "PRO" : "FREE";

      // Free orgs only get the 24h reminder
      if (tier === "FREE" && minutes !== 1440) continue;

      // Determine which reminders this org sends
      const configEntry = tierMap.get(ben.id);
      const orgReminders: ReminderDefinition[] = configEntry
        ? configEntry.reminders
        : (tier === "PRO" ? DEFAULT_PRO_REMINDERS : DEFAULT_FREE_REMINDERS);

      const match = orgReminders.find((r) => r.enabled && r.minutesBefore === minutes);
      if (!match) continue;

      try {
        await processReminder(
          { ...signup, student },
          minutes,
          tier
        );
      } catch (err) {
        console.error(`[eventReminders] Failed reminder for signup ${signup.id} (${minutes}m):`, (err as any)?.message);
      }
    }
  }
}

let reminderTimer: NodeJS.Timeout | null = null;

export function startEventReminderScheduler(): void {
  if (reminderTimer) return;
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_REMINDER_SCHEDULER === "true") return;
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    console.info("[eventReminders] Scheduler disabled in serverless environment.");
    return;
  }

  const run = () => {
    void runEventReminderCycle().catch((err) => {
      console.error("[eventReminders] Cycle error:", err);
    });
  };

  setTimeout(run, 30_000); // initial delay at startup
  reminderTimer = setInterval(run, INTERVAL_MS);
  console.info("[eventReminders] Event reminder scheduler active (15 min interval)");
}

export { runEventReminderCycle };
