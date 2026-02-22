import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM;

// Prefer an explicit, stable app URL in production.
// Falls back to Vercel-provided URL for previews, and localhost for local dev.
const CLIENT_URL =
  process.env.CLIENT_URL ??
  process.env.NEXT_PUBLIC_CLIENT_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");

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

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    const msg = "[email] RESEND_API_KEY is not set";
    console.error(msg);
    throw new Error(msg);
  }
  if (!FROM) {
    const msg = "[email] EMAIL_FROM is not set (sender address missing)";
    console.error(msg);
    throw new Error(msg);
  }

  try {
    const res = await resend.emails.send({ from: FROM, to, subject, html });

    // Resend returns either { data } or { error }
    // We throw on error so API routes can surface a 500 and Vercel logs show the cause.
    const error = (res as any)?.error;
    if (error) {
      console.error(
        `[email] Failed to send \"${subject}\" to ${to}:`,
        {
          name: error.name,
          message: error.message,
          // include any status/code fields if present
          statusCode: (error as any).statusCode,
          code: (error as any).code,
        }
      );
      throw new Error(error.message ?? "Resend email send failed");
    }

    const data = (res as any)?.data;
    if (!data) {
      console.warn(`[email] No data returned when sending \"${subject}\" to ${to}\"`);
    } else {
      console.info(`[email] Sent \"${subject}\" to ${to}`, { id: (data as any).id });
    }
  } catch (err) {
    console.error(`[email] Exception while sending \"${subject}\" to ${to}:`, err);
    throw err;
  }
}

export async function sendVerificationEmail(to: string, verificationLink: string): Promise<void> {
  await send(
    to,
    "Verify your GoodHours account",
    base(
      "Verify your email address",
      "Thanks for signing up for GoodHours. Click the button below to verify your email address and activate your account. This link expires in 24 hours.",
      { label: "Verify Email", url: verificationLink }
    )
  );
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  await send(
    to,
    "Reset your GoodHours password",
    base(
      "Reset your password",
      "We received a request to reset your GoodHours password. Click the button below to choose a new password. This link expires in 1 hour. If you didn't request a reset, you can ignore this email.",
      { label: "Reset Password", url: resetLink }
    )
  );
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
