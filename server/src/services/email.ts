import { Resend } from "resend";

let resendClient: Resend | null | undefined;

const FROM = process.env.EMAIL_FROM;
const MAILINATOR_FROM = process.env.MAILINATOR_EMAIL_FROM;

// Prefer an explicit, stable app URL in production.
// Falls back to Vercel-provided URL for previews, and localhost for local dev.
const CLIENT_URL =
  process.env.CLIENT_URL ??
  process.env.NEXT_PUBLIC_CLIENT_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");

// True in the deployed dev environment (hourly-dev.vercel.app) and local dev.
// Never true in production (goodhours.app).
function isDevEnv(): boolean {
  return (
    process.env.APP_ENV === "development" ||
    (process.env.APP_ENV !== "production" &&
      process.env.NODE_ENV !== "production" &&
      process.env.VERCEL_ENV !== "production")
  );
}

type EmailDeliveryMode = "auto" | "send" | "log";

function getEmailDeliveryMode(): EmailDeliveryMode {
  const raw = String(process.env.EMAIL_DELIVERY_MODE || "auto").trim().toLowerCase();
  if (raw === "send" || raw === "log") return raw;
  return "auto";
}

function shouldLogOnlyEmailDelivery(to: string): boolean {
  if (isMailinatorAddress(to)) return false;
  const mode = getEmailDeliveryMode();
  if (mode === "send") return false;
  if (mode === "log") return true;
  return isDevEnv() && (!process.env.RESEND_API_KEY || !FROM || !!devProviderSuppressedReason);
}

type CapturedEmail = {
  to: string;
  from: string;
  subject: string;
  html: string;
  sentAt: number;
};

const capturedMailinatorEmails: CapturedEmail[] = [];
const MAX_CAPTURED_MAILINATOR_EMAILS = 800;
let devProviderSuppressedReason: string | null = null;
let devProviderSuppressedLogged = false;

function getResendClient(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  resendClient = apiKey ? new Resend(apiKey) : null;
  return resendClient;
}

function shouldSuppressProviderInDev(err: any): boolean {
  if (!isDevEnv()) return false;
  const status = Number(err?.statusCode ?? err?.status ?? 0);
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    status === 401 ||
    msg.includes("api key is invalid") ||
    msg.includes("invalid api key") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden")
  );
}

function noteDevProviderSuppressed(err: any): void {
  if (!shouldSuppressProviderInDev(err)) return;
  devProviderSuppressedReason = String(err?.message ?? "provider rejected development email configuration");
  if (devProviderSuppressedLogged) return;
  devProviderSuppressedLogged = true;
  console.warn("[email:dev] Disabling provider email delivery for this process; falling back to log-only mode.", {
    message: err?.message,
    statusCode: err?.statusCode ?? err?.status,
    code: err?.code,
  });
}

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.RESEND_API_KEY) {
    console.error("[email] Missing RESEND_API_KEY in production environment");
  }
  if (!FROM) {
    console.error(
      "[email] Missing EMAIL_FROM in production environment (do not rely on a default sender)"
    );
  }
  if (!process.env.CLIENT_URL && !process.env.NEXT_PUBLIC_CLIENT_URL) {
    console.warn(
      `[email] CLIENT_URL not explicitly set in production; using fallback CLIENT_URL=${CLIENT_URL}`
    );
  }
}

function base(title: string, body: string, cta?: { label: string; url: string }): string {
  const ctaHtml = cta
    ? `<div style="margin:32px 0;text-align:center">
        <a href="${cta.url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;display:inline-block">${cta.label}</a>
      </div>`
    : "";
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:0">
<div style="max-width:520px;margin:48px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#2563eb;padding:20px 32px"><span style="color:#fff;font-size:20px;font-weight:700">GoodHours</span></div>
  <div style="padding:32px">
    <h2 style="margin:0 0 12px;font-size:20px;color:#111827">${title}</h2>
    <div style="color:#374151;font-size:15px;line-height:1.6">${body}</div>
    ${ctaHtml}
    <p style="color:#9ca3af;font-size:12px;margin:32px 0 0">If you didn't expect this email, you can safely ignore it.</p>
  </div>
</div>
</body></html>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableEmailError(err: any): boolean {
  if (!err) return false;
  const status = Number(err?.statusCode ?? err?.status ?? 0);
  const code = String(err?.code ?? "").toLowerCase();
  const msg = String(err?.message ?? "").toLowerCase();
  if (status === 408 || status === 429 || status >= 500) return true;
  if (code.includes("timeout") || code.includes("econn") || code.includes("rate")) return true;
  if (msg.includes("timeout") || msg.includes("temporar") || msg.includes("rate")) return true;
  return false;
}

function isSenderRejectedEmailError(err: any): boolean {
  const status = Number(err?.statusCode ?? err?.status ?? 0);
  const msg = String(err?.message ?? "").toLowerCase();
  if (status === 400 || status === 403) return true;
  return (
    msg.includes("sender") ||
    msg.includes("from") ||
    msg.includes("domain") ||
    msg.includes("verify")
  );
}

function getFromCandidates(to: string): string[] {
  const candidates: string[] = [];
  if (FROM) {
    candidates.push(FROM);
  }
  if (isMailinatorAddress(to) && MAILINATOR_FROM) {
    candidates.push(MAILINATOR_FROM);
  }
  return Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));
}

function withMailinatorNonce(html: string): string {
  return `${html}\n<!-- gh-mailinator-${Date.now()}-${Math.random().toString(36).slice(2, 8)} -->`;
}

function canUseLocalMailinatorFallback(to: string): boolean {
  return (
    isMailinatorAddress(to) &&
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  );
}

function captureMailinatorEmail(to: string, subject: string, html: string, from: string): void {
  capturedMailinatorEmails.unshift({
    to: to.trim().toLowerCase(),
    from: from.trim(),
    subject,
    html,
    sentAt: Date.now(),
  });
  if (capturedMailinatorEmails.length > MAX_CAPTURED_MAILINATOR_EMAILS) {
    capturedMailinatorEmails.length = MAX_CAPTURED_MAILINATOR_EMAILS;
  }
}

export function getCapturedMailinatorInbox(inbox: string): CapturedEmail[] {
  const target = `${inbox.trim().toLowerCase()}@mailinator.com`;
  return capturedMailinatorEmails.filter((entry) => entry.to === target);
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const defaultFrom = FROM?.trim() || MAILINATOR_FROM?.trim() || "noreply@notifications.goodhours.app";

  // In explicitly log-only mode, or in auto mode without real provider config,
  // keep local/dev flows usable without silently pretending delivery succeeded.
  if (shouldLogOnlyEmailDelivery(to)) {
    if (devProviderSuppressedReason && !devProviderSuppressedLogged) {
      devProviderSuppressedLogged = true;
      console.warn("[email:dev] Provider email delivery suppressed in this process.", {
        reason: devProviderSuppressedReason,
      });
    }
    console.info(
      `[email:dev] Would send "${subject}" → ${to}\n` +
      `  from: ${defaultFrom}\n` +
      `  body: ${html.replace(/<[^>]+>/g, "").slice(0, 200).trim()}…`
    );
    return;
  }

  if (canUseLocalMailinatorFallback(to)) {
    captureMailinatorEmail(to, subject, html, defaultFrom);
    console.info(`[email] Captured "${subject}" locally for ${to}`);
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    if (canUseLocalMailinatorFallback(to)) {
      captureMailinatorEmail(to, subject, html, defaultFrom);
      console.warn(`[email] Captured "${subject}" locally for ${to} (missing RESEND_API_KEY)`);
      return;
    }
    const msg = "[email] RESEND_API_KEY is not set";
    console.error(msg);
    throw new Error(msg);
  }

  const resend = getResendClient();
  if (!resend) {
    const msg = "[email] Email provider is unavailable because RESEND_API_KEY is not configured";
    console.error(msg);
    throw new Error(msg);
  }

  const fromCandidates = getFromCandidates(to);
  if (!fromCandidates.length) {
    if (canUseLocalMailinatorFallback(to)) {
      captureMailinatorEmail(to, subject, html, defaultFrom);
      console.warn(`[email] Captured "${subject}" locally for ${to} (no configured sender)`);
      return;
    }
    const msg = "[email] No valid sender address configured (EMAIL_FROM / MAILINATOR_EMAIL_FROM)";
    console.error(msg);
    throw new Error(msg);
  }

  let lastError: any = null;
  const retryDelaysMs = [0, 1000, 2500, 5000];

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    if (retryDelaysMs[attempt] > 0) {
      await sleep(retryDelaysMs[attempt]);
    }

    try {
      let sent = false;
      let candidateError: any = null;

      for (let senderIndex = 0; senderIndex < fromCandidates.length; senderIndex += 1) {
        const from = fromCandidates[senderIndex];
        try {
          const res = await resend.emails.send({
            from,
            to,
            subject,
            html: isMailinatorAddress(to) ? withMailinatorNonce(html) : html,
          });

          // Resend returns either { data } or { error }
          const error = (res as any)?.error;
          if (error) {
            const wrapped = Object.assign(new Error(error.message ?? "Resend email send failed"), {
              statusCode: (error as any).statusCode,
              code: (error as any).code,
              name: error.name,
            });
            throw wrapped;
          }

          const data = (res as any)?.data;
          if (!data) {
            console.warn(`[email] No data returned when sending "${subject}" to ${to}`);
          } else {
            console.info(`[email] Sent "${subject}" to ${to}`, { id: (data as any).id, from });
          }
          sent = true;
          break;
        } catch (err: any) {
          candidateError = err;
          const canTryAnotherSender =
            senderIndex < fromCandidates.length - 1 && isSenderRejectedEmailError(err);
          if (!canTryAnotherSender) {
            throw err;
          }
        }
      }

      if (!sent) {
        throw candidateError ?? new Error("Email send failed");
      }
      return;
    } catch (err: any) {
      lastError = err;
      noteDevProviderSuppressed(err);
      if (devProviderSuppressedReason) {
        console.info(
          `[email:dev] Would send "${subject}" → ${to}\n` +
          `  from: ${defaultFrom}\n` +
          `  body: ${html.replace(/<[^>]+>/g, "").slice(0, 200).trim()}…`
        );
        return;
      }
      const willRetry = attempt < retryDelaysMs.length - 1 && isRetryableEmailError(err);
      console.error(
        `[email] Send attempt ${attempt + 1}/${retryDelaysMs.length} failed for "${subject}" to ${to}`,
        {
          name: err?.name,
          message: err?.message,
          statusCode: err?.statusCode ?? err?.status,
          code: err?.code,
          willRetry,
        }
      );
      if (!willRetry) break;
    }
  }

  if (canUseLocalMailinatorFallback(to)) {
    captureMailinatorEmail(to, subject, html, fromCandidates[0] || defaultFrom);
    console.warn(
      `[email] Captured "${subject}" locally for ${to} after provider send failures`,
      {
        message: (lastError as any)?.message,
        statusCode: (lastError as any)?.statusCode,
      }
    );
    return;
  }

  throw lastError ?? new Error("Email send failed");
}

function isMailinatorAddress(email: string): boolean {
  return /@mailinator\.com$/i.test(email.trim());
}

async function sendWithMailinatorRedundancy(to: string, subject: string, html: string): Promise<void> {
  await send(to, subject, html);

  if (canUseLocalMailinatorFallback(to)) {
    return;
  }

  // Public inbox providers can occasionally delay/drop single deliveries.
  // Send one delayed duplicate to reduce flake in inbox polling while keeping
  // provider rate pressure low.
  if (isMailinatorAddress(to)) {
    await sleep(1800);
    try {
      await send(to, subject, html);
    } catch (err) {
      // First send already succeeded; keep endpoint behavior stable.
      console.warn(`[email] Mailinator redundancy send failed for "${subject}" to ${to}`, {
        message: (err as any)?.message,
        code: (err as any)?.code,
        statusCode: (err as any)?.statusCode,
      });
    }
  }
}

export async function sendVerificationEmail(to: string, verificationLink: string): Promise<void> {
  const subject = "Verify your GoodHours account";
  const html = base(
    "Verify your email address",
    "Thanks for signing up for GoodHours. Click the button below to verify your email address and activate your account. This link expires in 24 hours.",
    { label: "Verify Email", url: verificationLink }
  );
  await sendWithMailinatorRedundancy(to, subject, html);
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const subject = "Reset your GoodHours password";
  const html = base(
    "Reset your password",
    "We received a request to reset your GoodHours password. Click the button below to choose a new password. This link expires in 1 hour. If you didn't request a reset, you can ignore this email.",
    { label: "Reset Password", url: resetLink }
  );
  await sendWithMailinatorRedundancy(to, subject, html);
}

export async function sendHourApprovedEmail(
  to: string,
  orgName: string,
  hours: number,
  eventName: string
): Promise<void> {
  await send(
    to,
    "Your volunteer hours have been approved",
    base(
      "Hours approved!",
      `<strong>${orgName}</strong> has approved your <strong>${hours} hour${hours !== 1 ? "s" : ""}</strong> for <em>${eventName}</em>. They've been added to your verified hours total.`,
      { label: "View Dashboard", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export async function sendHourRemovedEmail(
  to: string,
  hours: number,
  eventName: string
): Promise<void> {
  await send(
    to,
    "Your volunteer hours have been removed",
    base(
      "Hours removed",
      `Your school admin has removed <strong>${hours} hour${hours !== 1 ? "s" : ""}</strong> previously credited for <em>${eventName}</em>. If you have questions, please contact your classroom admin.`,
      { label: "View Dashboard", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export async function sendStudentLeftClassroomEmail(
  to: string,
  studentName: string,
  classroomName: string
): Promise<void> {
  await send(
    to,
    `${studentName} has left your classroom`,
    base(
      "Student left classroom",
      `<strong>${studentName}</strong> has left <strong>${classroomName}</strong>. Their verified hours remain on record.`,
      { label: "View Classroom", url: `${CLIENT_URL}/groups` }
    )
  );
}

export async function sendOrgApprovalRequestEmail(to: string, orgName: string): Promise<void> {
  await send(
    to,
    "New organization approval request",
    base(
      "A new organization wants to join your approved list",
      `<strong>${orgName}</strong> has requested to be added to your school's approved organizations list. Approved organizations appear at the top of your students' opportunity feed.`,
      { label: "Review Request", url: `${CLIENT_URL}/groups` }
    )
  );
}

export async function sendOrgRequestApprovedEmail(to: string, schoolName: string): Promise<void> {
  await send(
    to,
    "Your organization has been approved",
    base(
      "Approval confirmed",
      `<strong>${schoolName}</strong> has added your organization to their approved list. Your opportunities will now appear prominently for their students.`,
      { label: "View Dashboard", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export async function sendAdminTransferRequestEmail(
  to: string,
  adminName: string,
  classroomName: string
): Promise<void> {
  await send(
    to,
    "Classroom admin transfer request",
    base(
      "Admin transfer requires your approval",
      `<strong>${adminName}</strong> has requested to transfer admin access for <strong>${classroomName}</strong>. Once approved, the current admin will lose all access to that classroom.`,
      { label: "Review Request", url: `${CLIENT_URL}/groups` }
    )
  );
}

export interface EventReminderParams {
  to: string;
  eventName: string;
  eventDate: string;     // human-readable, e.g. "Saturday, July 12"
  startTime: string;
  endTime: string;
  location: string;
  address?: string;
  cancellationToken?: string;
  // Pro-only fields (omit for Free)
  preparationNotes?: string;
  arrivalInstructions?: string;
  contactInfo?: string;
  requiredFormUrl?: string;
  requiredFormName?: string;
  customMessage?: string;
  // Org branding (Pro)
  brandColor?: string;
  orgLogoUrl?: string;
  emailSignature?: string;
  orgName?: string;
  // ICS attachment
  icsContent?: string;  // pre-generated ICS string
}

export async function sendEventReminderEmail(params: EventReminderParams): Promise<void> {
  const {
    to, eventName, eventDate, startTime, endTime, location, address,
    cancellationToken, preparationNotes, arrivalInstructions, contactInfo,
    requiredFormUrl, requiredFormName, customMessage,
    brandColor, orgLogoUrl, emailSignature, orgName, icsContent,
  } = params;

  const accentColor = brandColor ?? "#2563eb";
  const fromOrgName = orgName ?? "GoodHours";

  const mapsLink = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  const cancelSection = cancellationToken
    ? `<p style="margin:20px 0 0;font-size:13px;color:#6b7280">
        Can't make it? <a href="${CLIENT_URL}/cancel/${cancellationToken}" style="color:${accentColor}">Cancel your spot</a> so we can offer it to someone on the waitlist.
      </p>`
    : "";

  const proBlocks: string[] = [];

  if (requiredFormUrl && requiredFormName) {
    proBlocks.push(`<div style="margin:20px 0;padding:14px 16px;background:#fef9c3;border-left:4px solid #ca8a04;border-radius:4px">
      <strong style="color:#92400e">Action required:</strong> Complete <a href="${requiredFormUrl}" style="color:#92400e">${requiredFormName}</a> before attending.
    </div>`);
  }

  if (preparationNotes) {
    proBlocks.push(`<div style="margin:16px 0"><strong>Preparation:</strong><br>${preparationNotes.replace(/\n/g, "<br>")}</div>`);
  }

  if (arrivalInstructions) {
    proBlocks.push(`<div style="margin:16px 0"><strong>Arrival instructions:</strong><br>${arrivalInstructions.replace(/\n/g, "<br>")}</div>`);
  }

  if (contactInfo) {
    proBlocks.push(`<div style="margin:16px 0"><strong>On-site contact:</strong><br>${contactInfo.replace(/\n/g, "<br>")}</div>`);
  }

  if (customMessage) {
    proBlocks.push(`<div style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-radius:4px;color:#374151">${customMessage.replace(/\n/g, "<br>")}</div>`);
  }

  const signatureBlock = emailSignature
    ? `<p style="margin:20px 0 0;font-size:13px;color:#374151">${emailSignature.replace(/\n/g, "<br>")}</p>`
    : "";

  const logoBlock = orgLogoUrl
    ? `<img src="${orgLogoUrl}" alt="${fromOrgName}" style="max-height:40px;max-width:160px;object-fit:contain;display:block;margin-bottom:8px">`
    : "";

  const body = `
    ${logoBlock}
    Don't forget — you're signed up for <strong>${eventName}</strong>.<br><br>
    📅 ${eventDate}, ${startTime}–${endTime}<br>
    📍 ${location}<br>
    <a href="${mapsLink}" style="color:${accentColor};font-size:13px">Get directions</a>
    ${proBlocks.join("")}
    ${cancelSection}
    ${signatureBlock}
  `;

  // Build the branded email wrapper
  const ctaHtml = `<div style="margin:24px 0;text-align:center">
    <a href="${CLIENT_URL}/dashboard" style="background:${accentColor};color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;display:inline-block">View Event</a>
  </div>`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:0">
<div style="max-width:520px;margin:48px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:${accentColor};padding:20px 32px"><span style="color:#fff;font-size:20px;font-weight:700">${fromOrgName}</span></div>
  <div style="padding:32px">
    <h2 style="margin:0 0 12px;font-size:20px;color:#111827">Upcoming volunteer event</h2>
    <div style="color:#374151;font-size:15px;line-height:1.6">${body}</div>
    ${ctaHtml}
    <p style="color:#9ca3af;font-size:12px;margin:32px 0 0">If you didn't expect this email, you can safely ignore it.</p>
  </div>
</div>
</body></html>`;

  if (icsContent) {
    // Send with ICS attachment via Resend
    const resend = getResendClient();
    if (resend && !shouldLogOnlyEmailDelivery(to)) {
      const fromAddr = (getFromCandidates(to)[0] ?? FROM ?? "noreply@notifications.goodhours.app").trim();
      const subject = `Reminder: ${eventName} is coming up`;
      try {
        await resend.emails.send({
          from: fromAddr,
          to,
          subject,
          html,
          attachments: [{
            filename: "event.ics",
            content: Buffer.from(icsContent, "utf8").toString("base64"),
          }],
        });
        console.info(`[email] Sent reminder with ICS for "${eventName}" to ${to}`);
        return;
      } catch (err) {
        console.error("[email] ICS attachment send failed, falling back to plain send:", (err as any)?.message);
      }
    }
  }

  await send(to, `Reminder: ${eventName} is coming up`, html);
}

// ─── New invitation emails ────────────────────────────────────────

export async function sendStudentInvitationEmail(
  to: string,
  studentName: string | null,
  cohortName: string,
  schoolName: string,
  magicLink: string
): Promise<void> {
  const subject = `You've been invited to join ${schoolName} on GoodHours`;
  const greeting = studentName ? `Hi ${studentName},` : "Hello,";
  const html = base(
    `Welcome to ${schoolName} on GoodHours`,
    `${greeting}<br><br><strong>${schoolName}</strong> has invited you to join the <strong>${cohortName}</strong> cohort on GoodHours — the platform for tracking and verifying your community service hours.<br><br>Click the button below to create your account and get started. This link expires in 72 hours.`,
    { label: "Accept Invitation", url: magicLink }
  );
  await sendWithMailinatorRedundancy(to, subject, html);
}

export async function sendBeneficiaryInvitationEmail(
  to: string,
  beneficiaryName: string,
  schoolName: string,
  magicLink: string,
  customMessage?: string | null
): Promise<void> {
  const subject = `${schoolName} invited ${beneficiaryName} to partner on GoodHours`;
  const customBlock = customMessage?.trim()
    ? `<br><br><strong>Message from ${schoolName}:</strong><br>${customMessage.trim().replace(/\n/g, "<br>")}`
    : "";
  const html = base(
    `Accept your GoodHours partnership invite`,
    `<strong>${schoolName}</strong> invited <strong>${beneficiaryName}</strong> to join GoodHours as a community partner for their students.<br><br>Use the button below to accept the partnership, finish setup, and start publishing volunteer opportunities. This link expires in 7 days.${customBlock}`,
    { label: "Accept Partnership", url: magicLink }
  );
  await sendWithMailinatorRedundancy(to, subject, html);
}

export async function sendSchoolRegistrationMagicLink(
  to: string,
  schoolName: string,
  magicLink: string
): Promise<void> {
  const subject = "Complete your GoodHours school registration";
  const html = base(
    `Register ${schoolName} on GoodHours`,
    `Click the button below to complete your school's registration on GoodHours. This link expires in 24 hours and can only be used once.<br><br>If you did not request this, please ignore this email.`,
    { label: "Complete Registration", url: magicLink }
  );
  await sendWithMailinatorRedundancy(to, subject, html);
}

export async function sendOrganizationProcurementUpdateEmail(input: {
  to: string;
  organizationName: string;
  subject: string;
  message: string;
}): Promise<void> {
  const html = base(
    input.subject,
    `Hello,<br><br>${input.message.trim().replace(/\n/g, "<br>")}<br><br>` +
      `This update is about your GoodHours procurement request for <strong>${input.organizationName}</strong>.`,
    { label: "View Billing Status", url: `${CLIENT_URL}/settings?tab=billing` }
  );
  await sendWithMailinatorRedundancy(input.to, input.subject, html);
}

export async function sendSelfSubmissionApprovedEmail(
  to: string,
  studentName: string,
  orgName: string,
  hours: number
): Promise<void> {
  await send(
    to,
    "Your self-submitted hours have been approved",
    base(
      "Hours approved!",
      `Hi ${studentName},<br><br>Your school has approved your <strong>${hours} hour${hours !== 1 ? "s" : ""}</strong> of volunteering at <strong>${orgName}</strong>. They've been added to your verified hours total.`,
      { label: "View Dashboard", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export async function sendSelfSubmissionRejectedEmail(
  to: string,
  studentName: string,
  orgName: string,
  reason: string
): Promise<void> {
  await send(
    to,
    "Your self-submitted hours were not approved",
    base(
      "Hours not approved",
      `Hi ${studentName},<br><br>Your self-submitted hours at <strong>${orgName}</strong> were not approved by your school.<br><br>Reason: ${reason}<br><br>Please contact your school administrator if you have questions.`,
      { label: "View Dashboard", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export async function sendNewSubmissionAlertEmail(
  to: string,
  adminName: string,
  studentName: string,
  orgName: string,
  hours: number
): Promise<void> {
  await send(
    to,
    `New self-submitted hours pending review — ${studentName}`,
    base(
      "New submission to review",
      `Hi ${adminName},<br><br><strong>${studentName}</strong> submitted <strong>${hours} hour${hours !== 1 ? "s" : ""}</strong> at <strong>${orgName}</strong> for your review.`,
      { label: "Review Submissions", url: `${CLIENT_URL}/submissions` }
    )
  );
}

export async function sendSubmissionRevisionEmail(
  to: string,
  studentName: string,
  orgName: string,
  note: string
): Promise<void> {
  await send(
    to,
    "Your submission needs revision",
    base(
      "Revision requested",
      `Hi ${studentName},<br><br>Your submission for <strong>${orgName}</strong> has been sent back for revision by your school.<br><br><strong>Note from reviewer:</strong><br>${note}<br><br>Please update your submission and resubmit.`,
      { label: "View Submission", url: `${CLIENT_URL}/submit` }
    )
  );
}

export async function sendServiceDeadlineReminderEmail(
  to: string,
  studentName: string,
  schoolName: string,
  remainingHours: number,
  daysToDeadline: number,
  deadline: Date | null
): Promise<void> {
  const dueText = deadline ? deadline.toLocaleDateString() : "your service deadline";
  await send(
    to,
    `${schoolName} service deadline reminder`,
    base(
      "Service deadline reminder",
      `Hi ${studentName},<br><br>You still have <strong>${remainingHours.toFixed(1)} hour${remainingHours === 1 ? "" : "s"}</strong> remaining for <strong>${schoolName}</strong>.<br><br>${daysToDeadline < 0 ? "The deadline has passed." : `There ${daysToDeadline === 1 ? "is" : "are"} <strong>${Math.max(daysToDeadline, 0)}</strong> day${daysToDeadline === 1 ? "" : "s"} left before <strong>${dueText}</strong>.`}`,
      { label: "Open Dashboard", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export async function sendBehindScheduleEmail(
  to: string,
  studentName: string,
  schoolName: string,
  approvedHours: number,
  requiredHours: number,
  reasons: string[]
): Promise<void> {
  await send(
    to,
    "You are behind on service hours",
    base(
      "Behind on service progress",
      `Hi ${studentName},<br><br>You currently have <strong>${approvedHours.toFixed(1)} of ${requiredHours.toFixed(1)} required hours</strong> for <strong>${schoolName}</strong>.<br><br>${reasons.length ? `Current risk factors:<br>${reasons.map((reason) => `• ${reason}`).join("<br>")}<br><br>` : ""}Please review your dashboard and make a plan to get back on track.`,
      { label: "Review Progress", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export async function sendOwnershipTransferConfirmationEmail(
  to: string,
  schoolName: string,
  targetName: string,
  targetEmail: string,
  confirmationLink: string
): Promise<void> {
  await send(
    to,
    `Confirm ownership transfer for ${schoolName}`,
    base(
      "Confirm school ownership transfer",
      `You requested to transfer ownership of <strong>${schoolName}</strong> to <strong>${targetName}</strong> (${targetEmail}).<br><br>Click below to confirm this transfer. Once confirmed, the target account becomes the school admin and your account is retained as teacher/staff access.`,
      { label: "Confirm Transfer", url: confirmationLink }
    )
  );
}

export async function sendAdminPendingReviewAlertEmail(
  to: string,
  adminName: string,
  schoolName: string,
  pendingReviewCount: number,
  atRiskStudentCount: number
): Promise<void> {
  await send(
    to,
    `${schoolName} has items waiting for review`,
    base(
      "Pending review alert",
      `Hi ${adminName},<br><br><strong>${pendingReviewCount}</strong> item${pendingReviewCount === 1 ? "" : "s"} are currently waiting for review in <strong>${schoolName}</strong>.<br><br><strong>${atRiskStudentCount}</strong> student${atRiskStudentCount === 1 ? "" : "s"} are currently flagged at risk.`,
      { label: "Open Review Queue", url: `${CLIENT_URL}/submissions` }
    )
  );
}

export async function sendTeacherInvitationEmail(
  to: string,
  teacherName: string,
  cohortName: string,
  schoolName: string,
  setupLink: string
): Promise<void> {
  const subject = `You've been invited to teach at ${schoolName} on GoodHours`;
  const html = base(
    `Welcome to ${schoolName} on GoodHours`,
    `Hi ${teacherName},<br><br><strong>${schoolName}</strong> has added you as a teacher for the <strong>${cohortName}</strong> cohort on GoodHours — the platform for tracking and verifying student community service hours.<br><br>Click the button below to set up your account. This link expires in 24 hours.`,
    { label: "Set Up Your Account", url: setupLink }
  );
  await sendWithMailinatorRedundancy(to, subject, html);
}

export async function sendTeacherAssignmentEmail(
  to: string,
  teacherName: string,
  cohortName: string,
  schoolName: string
): Promise<void> {
  const subject = `You've been assigned to teach ${cohortName} at ${schoolName}`;
  const html = base(
    `New cohort assignment`,
    `Hi ${teacherName},<br><br><strong>${schoolName}</strong> has assigned you to the <strong>${cohortName}</strong> cohort on GoodHours. You can now manage this cohort from your dashboard.`,
    { label: "Go to Dashboard", url: `${CLIENT_URL}/dashboard` }
  );
  await sendWithMailinatorRedundancy(to, subject, html);
}

export { CLIENT_URL };
