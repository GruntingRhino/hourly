import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM;
const MAILINATOR_FROM = process.env.MAILINATOR_EMAIL_FROM;

// Prefer an explicit, stable app URL in production.
// Falls back to Vercel-provided URL for previews, and localhost for local dev.
const CLIENT_URL =
  process.env.CLIENT_URL ??
  process.env.NEXT_PUBLIC_CLIENT_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");

type CapturedEmail = {
  to: string;
  from: string;
  subject: string;
  html: string;
  sentAt: number;
};

const capturedMailinatorEmails: CapturedEmail[] = [];
const MAX_CAPTURED_MAILINATOR_EMAILS = 800;

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

export async function sendEventReminderEmail(
  to: string,
  eventName: string,
  eventTime: string,
  location: string
): Promise<void> {
  await send(
    to,
    `Reminder: ${eventName} is coming up`,
    base(
      "Upcoming volunteer event",
      `Don't forget — you're signed up for <strong>${eventName}</strong>.<br><br>📅 ${eventTime}<br>📍 ${location}`,
      { label: "View Event", url: `${CLIENT_URL}/dashboard` }
    )
  );
}

export { CLIENT_URL };
