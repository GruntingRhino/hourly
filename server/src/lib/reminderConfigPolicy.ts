import { z } from "zod";

export const MAX_REMINDERS = 8;
export const MAX_REMINDER_MINUTES = 7 * 24 * 60;
export const MAX_WAITLIST_CUTOFF_HOURS = 30 * 24;
export const MAX_PROMO_MESSAGE_LENGTH = 2000;

export const reminderDefinitionSchema = z.object({
  minutesBefore: z.number().int().positive().max(MAX_REMINDER_MINUTES),
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(80),
}).strict();

const remindersSchema = z.array(reminderDefinitionSchema).min(1).max(MAX_REMINDERS).superRefine((reminders, ctx) => {
  const seen = new Set<number>();
  for (const [index, reminder] of reminders.entries()) {
    if (seen.has(reminder.minutesBefore)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "minutesBefore"],
        message: "Reminder offsets must be unique",
      });
    }
    seen.add(reminder.minutesBefore);
  }
});

const nullableTrimmedTemplate = z.string().trim().min(1).max(MAX_PROMO_MESSAGE_LENGTH).nullable();

export const reminderConfigInputSchema = z.object({
  reminders: remindersSchema.optional(),
  waitlistCutoffHours: z.number().int().positive().max(MAX_WAITLIST_CUTOFF_HOURS).nullable().optional(),
  requireApprovalForPromotion: z.boolean().optional(),
  disableAutoPromotion: z.boolean().optional(),
  promoMessageTemplate: nullableTrimmedTemplate.optional(),
}).strict();

export type ReminderDefinition = z.infer<typeof reminderDefinitionSchema>;
export type ReminderConfigInput = z.infer<typeof reminderConfigInputSchema>;

export function parseReminderConfigInput(input: unknown): ReminderConfigInput {
  return reminderConfigInputSchema.parse(input);
}

export function parseStoredReminders(raw: string | null | undefined, defaults: ReminderDefinition[]): ReminderDefinition[] {
  if (!raw) return defaults;
  try {
    const parsed = remindersSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaults;
  } catch {
    return defaults;
  }
}
