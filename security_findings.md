# GoodHours Security, Student-Privacy, and School-Procurement Audit

## Audit status

- **Repository:** GoodHours
- **Source commit reviewed:** `68540c8daff302c0ad2bba9adbf846e94c767ed7`
- **Audit date:** 2026-08-02
- **Scope:** application source, Prisma data model, authentication and authorization paths, school/teacher/student/beneficiary boundaries, Canvas and Google Classroom integrations, billing/webhook controls, uploads, exports, logging, security configuration, accessibility evidence, and school-procurement documentation.
- **Repository state during review:** working tree was clean before this report file was populated.
- **Dependency evidence:** fresh root and server production `npm audit` runs each reported zero known vulnerabilities.
- **Methodology:** direct source review followed by an adversarial verifier pass against exact-current files. Two independent three-agent review batches were attempted, but all six delegated reviewers failed at the provider connection layer and produced no evidence; those failed runs were excluded from the conclusions.
- **Code changes made by this audit:** none other than writing this report.
- **Security disposition:** **HOLD real-school claims and real-student onboarding until the P0/P1 findings are remediated and verified.**

This is a defensive technical assessment, not legal advice, a penetration test of production infrastructure, or a certification of FERPA, COPPA, ADA, WCAG, SOC 2, PCI DSS, or any state student-privacy law.

## Severity and classification

| Classification | Meaning |
|---|---|
| Verified vulnerability | A concrete attacker-controlled path reaches a sensitive disclosure or state mutation. |
| Architecture gap | A necessary trust boundary is structurally absent, although exploitation may require a legitimate role or lifecycle condition. |
| Compliance-evidence gap | Source cannot establish the required operational, contractual, or legal evidence. |
| Optional hardening | Defense-in-depth without a verified exploit in the reviewed source. |

## Executive release blockers

### P0 — disable or remediate before any configured LMS integration is exposed

1. Caller-controlled Canvas and Google Classroom origins can receive OAuth client secrets, authorization codes, refresh tokens, or bearer tokens.
2. The premature school-admin session path makes the LMS egress issue reachable by an account whose mailbox has not been verified.
3. Rotate any OAuth client secret if an untrusted school administrator could have exercised the vulnerable connection flow.

### P1 — remediate before processing real student data

1. Unverified password signups receive full privileged sessions and can claim school-directory records.
2. A Google identity can select and claim an unrelated unclaimed school without proving school-administrator authority.
3. Cross-school cohort memberships and stale LMS mappings are not centrally prohibited.
4. Teachers can read or mutate records outside their assigned cohorts through legacy same-school routes.
5. Beneficiary administrators receive real student names, internal IDs, and complete signup rows including cancellation capabilities.
6. Accepted beneficiary invitation tokens remain reusable as login credentials.

### P2 — complete before school procurement approval

1. Replace fail-open FERPA audit writes and remove duplicate student PII from audit details.
2. Require explicit LMS course selection before retrieving roster identities.
3. Replace mutating public GET cancellation links with a confirmation and one-time POST.
4. Complete manual accessibility testing and publish a current Accessibility Conformance Report.
5. Produce retention, deletion, backup, incident-response, subprocessor, DPA, and business-continuity evidence.

# 1. ARCHITECTURAL THREAT MODEL & TRUST BOUNDARIES

## 1.1 Principals

- Anonymous Internet visitor
- Unverified password signup
- Google-authenticated but school-ownership-unverified user
- Student
- Teacher
- School administrator
- Beneficiary/organization administrator
- Internal GoodHours operator
- Parent/guardian bearer-link holder
- Canvas tenant
- Google Classroom tenant
- Stripe and Stripe webhook sender
- Vercel scheduler and GitHub Actions OIDC caller
- Database, file storage, email provider, and rate-limit backend

## 1.2 Critical assets

- Student name, email, phone, grade, house, school, classroom, and cohort memberships
- Service sessions, self-submitted hours, beneficiary signups, approvals, rejections, signatures, and uploaded evidence
- Progress, intervention, deadline, no-show, and at-risk records
- Student/staff communications and notifications
- School rosters, reports, CSV/PDF exports, invitations, and directory claims
- Canvas and Google OAuth client secrets, access tokens, refresh tokens, and external mappings
- Password-reset, invitation, verification, registration, parent-access, and cancellation capabilities
- FERPA-oriented data-access and beneficiary audit logs
- Stripe customer, subscription, entitlement, and webhook records

## 1.3 Data-flow map

| Data flow | Trust transition | Enforcement observed | Structural weakness |
|---|---|---|---|
| Password school signup | Anonymous user → privileged school tenant | Zod validation, password hashing, personal-domain policy, rate limits | School is provisioned and claimed and a full token is issued before mailbox verification. |
| Google school registration | Google identity → GoodHours school authority | Google identity and signed bootstrap JWT | Google mailbox ownership is treated as authority to claim a user-selected school. |
| Authenticated API | Browser bearer token → Express → Prisma | Active-account and token-version validation, route role checks | Authentication does not enforce `emailVerified`; legacy routes use same-school rather than assigned-cohort scope. |
| LMS connection | School admin → GoodHours → provider token endpoint | School-admin role and signed OAuth state | Admin-controlled origins receive global OAuth credentials; redirect/origin pinning is incomplete. |
| LMS synchronization | Provider roster → integration mappings → local cohorts/users | Encrypted provider credentials and school-scoped connection records | Central membership helper does not compare student school, cohort school, and connection school. |
| Student records → school staff | Student associations → reports/interventions/sessions | Newer report paths use cohort-scope helpers | Legacy session, classroom, and intervention routes grant teachers school-wide access. |
| Student → beneficiary organization | Signup/event data → partner-facing API | Beneficiary ownership check and access logs | Partner response spreads complete ORM rows and discloses real student identity and cancellation capabilities. |
| Public bearer links | Email URL → public endpoint | Random tokens and rate limiting on many paths | Accepted invitation tokens remain login credentials; cancellation mutates state through GET. |
| Report/export | Staff query → CSV/PDF | Cohort checks in major reports and CSV formula neutralization | Audit persistence is fail-open and duplicates student identities. |
| Stripe webhook | Stripe → raw body → billing projection | Signature verification and durable deduplication | No critical bypass was verified. |
| Internal scheduler | Vercel/GitHub → internal routes | Cron secret and GitHub OIDC validation | High-value configuration surface requiring continuous tests; no bypass was verified. |

## 1.4 Structural defense-in-depth failures

1. **Identity, affiliation, and school authority are conflated.** Mailbox verification is not consistently required, and even a verified mailbox does not prove authority to claim a specific school.
2. **Tenant integrity depends on callers.** `ensureStudentCohortMembership` does not enforce the school invariant itself.
3. **Education records lack a durable owning-school boundary.** Service-hour records are primarily keyed to the student; a malformed cross-school association can expose cumulative history to another school.
4. **Teacher authorization is inconsistent.** Newer paths use assigned-cohort helpers while legacy paths use broad same-school checks.
5. **Partner serialization is not allowlisted.** ORM row spreading exposes fields unrelated to the beneficiary's purpose.
6. **Credential-bearing egress is not origin-pinned.** HTTPS validation is treated as provider trust.
7. **Auditability is best effort.** Sensitive responses can be released when the FERPA audit write fails.
8. **Disclosure consent is too coarse.** A school-wide PII Boolean is not a purpose-, event-, field-, recipient-, and expiry-bound grant.

## 1.5 Controls verified as present

- Bcrypt password hashing
- Hashed storage for password-reset, invitation, and email-verification tokens in major flows
- JWT token-version revocation and active-user checks
- Role middleware and cohort-scoping helpers in newer report/school routes
- AES-GCM-style authenticated field encryption for selected PII/integration credentials and a production key requirement
- Stripe raw-body signature verification and durable event deduplication
- Helmet/security headers and controlled CORS handling
- Hybrid rate limiting with durable backend support
- File-size limits, MIME-signature checks, and storage abstractions
- CSV formula-injection neutralization in the shared CSV helper
- React Router no-RSC/advisory guards
- Zero known production dependency vulnerabilities in fresh root/server audits

No verified SQL injection, command injection, path traversal, direct stored-XSS primitive, Stripe signature bypass, or production webhook replay defect was established from the reviewed source.

# 2. CRITICAL VULNERABILITY MATRIX

## Finding 1

- **Location:** `server/src/routes/auth.ts:424-696`, `server/src/routes/auth.ts:708-758`, `server/src/middleware/auth.ts:46-80`
- **Vulnerability Type:** Critical/High — Broken Authentication and Premature Privilege Provisioning
- **Impact:** A password signup creates and claims a school before mailbox ownership is proven, signs a full `SCHOOL_ADMIN` token, and returns it while `emailVerified` is false. Login reads but never enforces `emailVerified`, and authentication middleware does not select or enforce it. The account can invoke privileged school routes; when LMS credentials are configured, this can be chained into the credential-egress vulnerability.
- **Remediation Code:**

```ts
// Initial signup: create only a pending identity/claim and send verification.
return res.status(201).json({ requiresEmailVerification: true });

// Login: no full session until mailbox verification succeeds.
if (!user.emailVerified) {
  return res.status(403).json({ error: "Email verification required" });
}

// Authentication middleware: enforce durable current state.
const user = await prisma.user.findUnique({
  where: { id: payload.userId },
  select: {
    id: true,
    email: true,
    role: true,
    status: true,
    tokenVersion: true,
    emailVerified: true,
  },
});

if (!user || user.status !== "ACTIVE" || !user.emailVerified) {
  return res.status(401).json({ error: "Invalid or expired session" });
}
```

School creation and directory claiming must move to a post-verification, conditional transaction. Ownership-pending users must not receive roster, invitation, integration, export, or billing-management authority.

## Finding 2

- **Location:** `server/src/routes/auth.ts:440-465`, `server/src/routes/auth.ts:499-515`, `server/src/routes/auth.ts:660-670`, `server/src/routes/googleAuth.ts:258-269`, `server/src/routes/googleAuth.ts:826-981`
- **Vulnerability Type:** Critical — Improper School-Ownership Authorization and Replayable Privilege Bootstrap
- **Impact:** Password signup permits any `.edu` email to bypass the selected directory school's domain comparison. Google completion accepts a signed Google bootstrap token plus a user-selected directory school but never proves that the identity is an authorized administrator for that school; it creates the school as `verified: true` and marks the directory entry claimed. A still-valid bootstrap token can be replayed after registration to mint another full session. This enables school identity squatting and unauthorized creation of student records under a victim school's identity.
- **Remediation Code:**

```ts
function assertExactApprovedSchoolDomain(email: string, expectedDomain: string) {
  const actual = email.split("@")[1]?.trim().toLowerCase();
  const expected = expectedDomain.trim().toLowerCase();
  if (!actual || actual !== expected) {
    throw Object.assign(new Error("School identity could not be verified"), {
      status: 403,
    });
  }
}

// Domain proves affiliation only. Keep ownership pending until an approved
// claim code, district-admin consent, DNS proof, or manual adjudication succeeds.
const school = await tx.school.create({
  data: {
    name: dirEntry.name,
    verified: false,
    registrationEmail: googleProfile.email,
    ownershipStatus: "PENDING",
  },
});

const claimed = await tx.schoolDirectory.updateMany({
  where: { id: dirEntry.id, claimed: false },
  data: { claimed: true, claimedBySchoolId: school.id },
});
if (claimed.count !== 1) throw Object.assign(new Error("School already claimed"), { status: 409 });
```

Replace the reusable registration JWT with a short-lived opaque token whose hash is stored and transactionally changed from `consumedAt: null` to a timestamp exactly once.

## Finding 3

- **Location:** `server/src/routes/integrations.ts:44-89`, `server/src/services/canvasIntegration.ts:190-203`, `server/src/services/canvasIntegration.ts:1354-1424`, `server/src/services/googleClassroomIntegration.ts:210-218`, `server/src/services/googleClassroomIntegration.ts:593-618`, `server/src/services/googleClassroomIntegration.ts:623-634`, `server/src/services/googleClassroomIntegration.ts:1365-1439`
- **Vulnerability Type:** Critical — SSRF and OAuth Client-Secret/Bearer-Token Exfiltration
- **Impact:** School administrators control Canvas and Google Classroom base URLs. Production normalization requires HTTPS but does not establish provider identity. The selected origin is signed into OAuth state and later receives token exchanges containing the global client ID, client secret, callback URL, and attacker-supplied authorization code. Stored origins are also used for refresh/API requests carrying refresh or bearer tokens. An attacker-controlled HTTPS origin can therefore receive GoodHours OAuth credentials when those integrations are configured.
- **Remediation Code:**

```ts
const GOOGLE_AUTH_ORIGIN = "https://accounts.google.com";
const GOOGLE_TOKEN_ORIGIN = "https://oauth2.googleapis.com";
const GOOGLE_API_ORIGIN = "https://classroom.googleapis.com";

// Remove baseUrl from production Google connect input and OAuth state.
const googleOAuthConnectSchema = z.object({
  mode: z.literal("OAUTH"),
  displayName: z.string().trim().min(1).max(255).optional(),
}).strict();

async function fixedOriginFetch(url: URL, init: RequestInit) {
  const allowed = new Set([
    GOOGLE_AUTH_ORIGIN,
    GOOGLE_TOKEN_ORIGIN,
    GOOGLE_API_ORIGIN,
  ]);
  if (!allowed.has(url.origin)) throw new Error("Unapproved OAuth destination");
  return fetch(url, { ...init, redirect: "error" });
}

const CANVAS_ALLOWED_ORIGINS = new Set(
  (process.env.CANVAS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => new URL(entry).origin)
);

function normalizeApprovedCanvasOrigin(input: string): string {
  const parsed = new URL(input);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !CANVAS_ALLOWED_ORIGINS.has(parsed.origin)
  ) {
    throw new Error("Canvas origin has not been administratively approved");
  }
  return parsed.origin;
}
```

All credential-bearing fetches and pagination requests must use `redirect: "error"` and remain pinned to the approved origin. If arbitrary self-hosted Canvas tenants are required, use tenant-specific developer credentials rather than one global secret trusted by every tenant URL.

## Finding 4

- **Location:** `server/src/lib/studentCohorts.ts:14-56`, `server/src/services/canvasIntegration.ts:1079-1108`, corresponding Google Classroom user-mapping path in `server/src/services/googleClassroomIntegration.ts`, and school record queries such as `server/src/routes/sessions.ts:345-393`
- **Vulnerability Type:** High — Cross-Tenant Association Integrity Failure / Broken Object-Level Authorization
- **Impact:** The central membership helper creates or reactivates a membership without loading the cohort or comparing tenant IDs. A stale LMS mapping is trusted by local user ID and role without revalidating the student's current school. After a transfer, the previous school's integration can reactivate a prior-school cohort membership while the canonical `User.schoolId` remains the new school. School queries that trust active memberships can then regain access to the student's cumulative service records. The data model also lacks a durable owning-school field on major hour-bearing records, magnifying the impact of a malformed association.
- **Remediation Code:**

```ts
type MembershipDb = Pick<
  typeof prisma,
  "studentCohortMembership" | "user" | "cohort"
>;

export async function ensureStudentCohortMembership(params: {
  studentId: string;
  cohortId: string;
  schoolId: string;
  source: "MANUAL" | "INVITATION" | "CANVAS" | "GOOGLE_CLASSROOM";
  db?: MembershipDb;
}) {
  const db = params.db ?? prisma;
  const [student, cohort] = await Promise.all([
    db.user.findUnique({
      where: { id: params.studentId },
      select: { id: true, role: true, schoolId: true },
    }),
    db.cohort.findUnique({
      where: { id: params.cohortId },
      select: { id: true, schoolId: true },
    }),
  ]);

  if (
    !student ||
    student.role !== "STUDENT" ||
    !cohort ||
    student.schoolId !== params.schoolId ||
    cohort.schoolId !== params.schoolId
  ) {
    throw Object.assign(new Error("Cross-school membership rejected"), {
      status: 403,
      code: "TENANT_BOUNDARY_VIOLATION",
    });
  }

  return db.studentCohortMembership.upsert({
    where: { studentId_cohortId: { studentId: student.id, cohortId: cohort.id } },
    update: { isActive: true, source: params.source },
    create: {
      studentId: student.id,
      cohortId: cohort.id,
      source: params.source,
      isActive: true,
    },
  });
}
```

Revalidate every external mapping with `schoolId: params.schoolId`. Add `schoolId` to education-record models at creation and constrain staff queries by both authorized student scope and record-owning school. A transfer transaction must deactivate old-school memberships/mappings before changing the canonical school.

## Finding 5

- **Location:** `server/src/routes/classrooms.ts:168-249`, `server/src/routes/messages.ts:485-723`, `server/src/routes/messages.ts:725-979`, `server/src/routes/sessions.ts:307-393`
- **Vulnerability Type:** High — Improper Teacher Authorization / FERPA Legitimate-Interest Boundary Failure
- **Impact:** A teacher can access any classroom detail in the same school, including student names, email addresses, grades, and approved hours, and can update any same-school classroom if its ID is known. Teachers can list and mutate school-wide intervention cases, read campaign history and recipient identities, send bulk messages to all school students, list all school sessions, and download signature evidence based on same-school association. These routes bypass the assigned-cohort helpers used elsewhere and expose education records beyond the teacher's assigned students.
- **Remediation Code:**

```ts
const scope = await getStaffAccessScope(req.user!.userId);
if (!scope) return res.status(403).json({ error: "No school access" });

if (req.user!.role === "TEACHER") {
  const allowed = await assertStudentAccessibleToStaff(scope, studentId);
  if (!allowed) return res.status(404).json({ error: "Student not found" });
}

// Collection paths must build the student query from the same central policy.
const studentWhere = buildCohortScopedStudentWhere(scope);
const students = await prisma.user.findMany({
  where: studentWhere,
  select: { id: true },
});
```

For classroom detail/update, require `classroom.teacherId === req.user.userId` for teachers; only school administrators may reassign `teacherId`. Validate update input with a strict Zod schema and require the replacement teacher to belong to the same school. Apply the central scope to intervention lists/history, bulk recipients, session listings, and signature downloads.

## Finding 6

- **Location:** `server/src/routes/beneficiaries.ts:2605-2649`, `server/prisma/schema.prisma` (`BeneficiarySignup` scalar fields), `server/src/routes/beneficiaries.ts:3237-3295`
- **Vulnerability Type:** High — Excessive Student-Data Disclosure and Capability Leakage
- **Impact:** The beneficiary signup list loads real student names and spreads the complete Prisma signup row into a partner-facing response. It returns stable internal student IDs and, when populated, cancellation capabilities and unrelated internal fields. It does not apply the FERPA PII flag or the existing pseudonymous-label helper. A beneficiary administrator can correlate minors across events and can use a leaked cancellation token through the public cancellation path, bypassing an explicit organization-management action and causing misleading student attribution in the audit.
- **Remediation Code:**

```ts
function eventScopedVolunteerRef(params: {
  beneficiaryId: string;
  opportunityId: string;
  signupId: string;
}): string {
  return crypto
    .createHmac("sha256", process.env.STUDENT_ALIAS_KEY!)
    .update(`${params.beneficiaryId}:${params.opportunityId}:${params.signupId}`)
    .digest("base64url")
    .slice(0, 16);
}

const signups = await prisma.beneficiarySignup.findMany({
  where: {
    slot: { opportunity: { beneficiaryId: req.params.id } },
  },
  select: {
    id: true,
    status: true,
    verificationStatus: true,
    totalHours: true,
    createdAt: true,
    slot: {
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        opportunity: { select: { id: true, title: true } },
      },
    },
  },
});

res.json(signups.map((signup) => ({
  ...signup,
  volunteer: {
    ref: eventScopedVolunteerRef({
      beneficiaryId: req.params.id,
      opportunityId: signup.slot.opportunity.id,
      signupId: signup.id,
    }),
    label: "Registered volunteer",
  },
})));
```

Never return `studentId`, user ID, name, email, grade, house, school/cohort IDs, cancellation tokens, or unrelated review/audit fields by default. Real identity for physical check-in must use an event-specific, expiring, field-level, school-approved disclosure grant.

## Finding 7

- **Location:** `server/src/routes/invitations.ts:253-284`
- **Vulnerability Type:** High — Reusable Accepted Invitation as Authentication Credential
- **Impact:** After a beneficiary invitation has been accepted, presenting the same raw invitation token again causes the server to find the accepted beneficiary administrator and mint a fresh application JWT. The accepted branch occurs before expiration enforcement, so an invitation URL leaked through email history, browser history, forwarding, analytics, or logs remains a reusable account-login capability after its intended one-time acceptance.
- **Remediation Code:**

```ts
if (!inv || inv.status !== "PENDING" || inv.expiresAt <= new Date()) {
  return res.status(409).json({ error: "Invitation is no longer available" });
}

const accepted = await tx.beneficiaryInvitation.updateMany({
  where: {
    id: inv.id,
    status: "PENDING",
    expiresAt: { gt: new Date() },
  },
  data: {
    status: "ACCEPTED",
    acceptedAt: new Date(),
    respondedAt: new Date(),
    // Schema should permit null, or rotate to a fresh random unusable digest.
    token: null,
  },
});
if (accepted.count !== 1) {
  throw Object.assign(new Error("Invitation is no longer available"), { status: 409 });
}
```

Remove the `status === "ACCEPTED"` session-minting branch entirely. Accepted users must authenticate through the normal login or recovery flow.

## Finding 8

- **Location:** `server/src/routes/beneficiaries.ts:3237-3295`
- **Vulnerability Type:** Medium/High — State-Changing GET, Capability Leakage, and Audit Misattribution
- **Impact:** A GET request with a cancellation token immediately cancels a signup and promotes the next waitlisted student. Email-security scanners, link previewers, prefetchers, crawlers, or an embedded resource can trigger the action without a deliberate confirmation. The audit records `actorId: signup.studentId` even though possession of a bearer link does not prove that the student initiated the request. Finding 6 additionally discloses this token to beneficiary administrators.
- **Remediation Code:**

```ts
// GET only displays non-sensitive confirmation metadata; it never mutates state.
router.get("/cancel/:token", cancelLimiter, async (req, res) => {
  const signup = await findValidCancellation(req.params.token);
  if (!signup) return res.status(404).json({ error: "Invalid cancellation link" });
  return res.json({ requiresConfirmation: true, opportunityTitle: signup.title });
});

// POST transactionally consumes the token and records a capability actor.
router.post("/cancel/:token", cancelLimiter, async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const result = await prisma.$transaction(async (tx) => {
    const consumed = await tx.beneficiarySignup.updateMany({
      where: {
        cancellationTokenHash: tokenHash,
        cancellationTokenExpiresAt: { gt: new Date() },
        status: { not: "CANCELLED" },
      },
      data: {
        status: "CANCELLED",
        cancellationTokenHash: null,
        cancellationTokenExpiresAt: null,
      },
    });
    if (consumed.count !== 1) throw Object.assign(new Error("Invalid token"), { status: 409 });
    // Append audit with actorType: "CANCELLATION_CAPABILITY", not the student ID.
  });
  return res.json({ message: "Signup cancelled" });
});
```

## Finding 9

- **Location:** `server/src/lib/dataAccessLog.ts:5-30`, `server/src/lib/dataAccessLog.ts:74-86`, callers including `server/src/routes/reports.ts:43-61`
- **Vulnerability Type:** High Compliance/Integrity Gap — Fail-Open FERPA Auditing and Secondary PII Proliferation
- **Impact:** Sensitive roster/report/export responses continue when the audit insert fails, producing invisible access during an outage or database-permission failure. Audit details can duplicate up to 25 student names or emails per event, expanding breach scope and creating unstructured identity retention outside authoritative records. This is not a standalone account-compromise primitive, but it defeats an asserted accountability control schools rely on.
- **Remediation Code:**

```ts
export function summarizeStudentSubjects(studentIds: string[], auditKey: string) {
  const canonical = [...new Set(studentIds)].sort().join("\n");
  return {
    studentCount: studentIds.length,
    subjectSetDigest: crypto
      .createHmac("sha256", auditKey)
      .update(canonical)
      .digest("base64url"),
  };
}

// For sensitive reads, do not catch the audit failure and release data anyway.
const payload = await prisma.$transaction(async (tx) => {
  const students = await loadAuthorizedStudents(tx, scope);
  await tx.dataAccessLog.create({
    data: {
      actorId: req.user!.userId,
      action: "VIEW_STUDENT_REPORT",
      schoolId: scope.schoolId,
      details: JSON.stringify(
        summarizeStudentSubjects(students.map((student) => student.id), process.env.AUDIT_HMAC_KEY!)
      ),
    },
  });
  return buildResponse(students);
});
res.json(payload);
```

Use a separate best-effort telemetry logger for non-security events. The application database role should not update/delete append-only audit rows; controlled retention should use a separate role or archive process.

## Finding 10

- **Location:** `server/src/services/canvasIntegration.ts:650-715`, `server/src/services/googleClassroomIntegration.ts:671-730`
- **Vulnerability Type:** Medium/High Architecture Gap — Excessive Student-Roster Collection
- **Impact:** Synchronization enumerates every course visible to the OAuth identity and then retrieves every teacher/student roster for every returned course. There is no course-selection allowlist before identities are fetched. A district-wide administrator connection can therefore cause GoodHours to collect far more student data than the service-hours program requires. This is a verified minimization gap; the exact blast radius is bounded by the connected identity's provider permissions and is not an independent attacker exploit.
- **Remediation Code:**

```ts
const applySyncSchema = z.object({
  selectedExternalCourseIds: z
    .array(z.string().trim().min(1).max(255))
    .min(1)
    .max(100),
}).strict();

// Phase 1: retrieve metadata only and let the school select courses.
const selectedIds = new Set(input.selectedExternalCourseIds);
const selectedCourses = courses.filter((course) => selectedIds.has(String(course.id)));
if (selectedCourses.length !== selectedIds.size) {
  throw Object.assign(new Error("Unknown or inaccessible course selection"), { status: 400 });
}

// Phase 2: retrieve identities only for approved course IDs.
for (const course of selectedCourses) {
  await synchronizeSelectedCourse(connection, course);
}
```

Persist the approved course IDs with the connection, reject scheduled sync when the set is empty, and never process an upstream course not in the approved set.

# 3. ATTACK SURFACE EXPANSION

## 3.1 Externally reachable high-value surfaces

- Password signup/login, email verification, password recovery, and invitation acceptance
- Google login, registration bootstrap, school claim, and verification links
- Canvas and Google Classroom OAuth URLs, callbacks, preview/apply synchronization, errors, and status routes
- Parent-progress bearer links
- Public beneficiary cancellation links
- Stripe webhook and billing routes
- Internal reminder and directory-refresh endpoints
- Student CSV imports and staff CSV/PDF exports
- Signature/evidence and procurement-document uploads/downloads
- Messaging, notifications, intervention campaigns, and WebSocket communication
- Beneficiary event creation, signup, approval, no-show, and audit-history routes

## 3.2 Insecure privileged seed defaults

`server/prisma/seed.ts` and `server/prisma/seed-playwright.ts` contain fixed privileged test identities/passwords. They are intended for local/QA use, but accidental execution against production would create known accounts. Both scripts should fail before mutation unless all of the following hold:

- `APP_ENV !== "production"`
- `ALLOW_DESTRUCTIVE_TEST_SEED=yes`
- database host is local or an explicitly approved disposable test host
- database name ends in `_test`, `_qa`, or another enforced disposable suffix
- credentials are generated at runtime rather than committed literals

## 3.3 Browser bearer-token exposure

Client authentication tokens are accessible to browser JavaScript. No exploitable XSS was verified, so this is defense-in-depth rather than a confirmed session-theft vulnerability. A future same-origin XSS or compromised first-party script would immediately expose full sessions. Prefer short-lived access tokens held in memory with rotating `HttpOnly`, `Secure`, `SameSite=Strict` refresh cookies, or a server-side session.

## 3.4 Privileged-account assurance

No universal MFA or district-enforced SSO requirement was demonstrated for school administrators. Add phishing-resistant MFA or district SAML/OIDC enforcement for privileged users, plus session inventory, immediate revocation, and step-up authentication for:

- roster import/export
- school ownership transfer
- integration configuration
- PII disclosure changes
- bulk student messaging
- account deletion and billing administration

## 3.5 Staff lifecycle

Google login is not a substitute for district lifecycle management. SAML/OIDC, SCIM or equivalent provisioning/deprovisioning, role reconciliation, and emergency staff disablement were not demonstrated.

## 3.6 File-processing containment

File-size and signature checks exist, and downloads are generally attachments. Operational malware scanning, content-disarm/reconstruction, quarantine, retention, and incident evidence were not demonstrated. Office/PDF uploads should be scanned before becoming downloadable to other users.

## 3.7 Provider error persistence

Provider error bodies and synchronization error details can become logs/database records. Apply a strict error allowlist and redact tokens, authorization codes, student identities, upstream request IDs, and provider diagnostics before persistence.

## 3.8 Bearer-capability policy

All invitation, verification, recovery, parent, cancellation, and registration capabilities should share one policy:

- digest/HMAC at rest
- explicit purpose and subject binding
- short expiration
- one-time consumption where applicable
- revocation on role/account/tenant changes
- no mutating GET
- no token values in logs, analytics, broad DTOs, or referrer-bearing URLs
- audit attribution to the actual authenticated actor or named capability type

## 3.9 Export controls

CSV/PDF exports intentionally move student data outside GoodHours controls. Add configurable export disablement, reauthentication, dedicated export audit events, least-privilege roles, optional watermarking, and district retention guidance.

## 3.10 Operational and supply-chain evidence

Dependency scans were clean, but source inspection did not establish:

- continuous secret scanning
- SBOM generation and retention
- signed build/deployment provenance
- protected branches and required independent review
- vulnerability remediation SLAs
- annual independent penetration testing
- production database role separation
- key-management custody and rotation
- backup encryption and verified restoration
- geographic residency and disaster recovery

# 4. HARDENING AND VERIFICATION PLAN

## Criterion 1 — school identity and ownership

Real authenticated HTTP tests against disposable PostgreSQL must prove:

1. Unverified signup returns no full bearer token.
2. Unverified login fails.
3. Unverified/ownership-pending principals receive `403` on invitations, rosters, integrations, exports, and billing administration.
4. Initial signup does not claim the directory school.
5. A Google identity from School A cannot claim School B.
6. Domain match alone creates only a pending claim.
7. A consumed bootstrap token cannot be replayed.
8. Two concurrent claims produce exactly one owner.

## Criterion 2 — tenant and teacher-scope invariants

Create a student in School A, transfer the student to School B, retain a stale School A Canvas/Google mapping, and synchronize School A. Assert:

- no School A membership is created/reactivated
- all School A staff endpoints deny the student
- teachers cannot read or mutate students/classrooms outside assigned cohorts
- signature files, sessions, intervention notes/history, reports, exports, and bulk messaging obey the same central policy

Run this invariant after tests and migrations; acceptance is zero rows:

```sql
SELECT scm.id
FROM "StudentCohortMembership" scm
JOIN "User" u ON u.id = scm."studentId"
JOIN "Cohort" c ON c.id = scm."cohortId"
WHERE scm."isActive" = true
  AND u."schoolId" IS DISTINCT FROM c."schoolId";
```

## Criterion 3 — outbound egress and secret containment

Use an attacker-controlled canary HTTPS server and prove:

- arbitrary Google `baseUrl` input is rejected before networking
- Canvas accepts only exact administratively provisioned origins
- redirects fail and never forward client secrets or bearer tokens
- pagination remains on the approved origin
- no unapproved origin receives client ID/secret, code, refresh token, or access token

Add a static rule prohibiting credential-bearing `fetch()` calls whose origin derives from request input, OAuth state, or an unrestricted database URL.

## Criterion 4 — organization disclosure, capability lifecycle, and auditing

Authenticated response-contract tests must prove:

- beneficiary admins never receive student IDs, names, emails, grade, house, school/cohort IDs, cancellation tokens, or unrelated internal fields without an explicit event-scoped grant
- aliases differ across beneficiary and event boundaries
- accepted invitation tokens cannot mint sessions
- GET cancellation never mutates state
- one POST cancellation consumes the token exactly once
- audit events identify a capability actor rather than impersonating the student
- audit rows contain no student names/emails
- forced audit-write failure causes sensitive roster/report/export requests to return `503` without student data

## Criterion 5 — accessibility and procurement evidence

Run Playwright plus axe for every route and role at representative mobile/desktop widths, 200% and 400% zoom, keyboard-only navigation, reduced motion, and forced-colors/high-contrast mode. Acceptance:

- zero critical or serious axe violations
- no keyboard traps
- accessible names for every control
- visible, unclipped focus
- programmatically associated and announced errors
- target-level text and non-text contrast
- reflow without prohibited two-dimensional scrolling
- accessible session-timeout warnings

Supplement automation with manual VoiceOver and NVDA testing and a maintained Accessibility Conformance Report. Automated axe results alone do not establish ADA/WCAG compliance.

# 5. STUDENT SECURITY

## 5.1 Current disposition

**FAIL for real-student onboarding until Findings 1–7 are fixed and the verification criteria pass.**

## 5.2 Data-minimization assessment

| Data class | Minimum legitimate recipients | Assessment |
|---|---|---|
| Student name/email/phone | Student and authorized school personnel | Core profile controls exist, but partner endpoint Finding 6 directly releases identity. |
| Grade/house/cohort | Authorized school personnel | Coarse partner PII configuration is not a minimum-necessary grant. |
| Signup identity | Student and school; event partner only when operationally necessary | Current beneficiary list exposes real name, stable ID, and complete signup row. |
| Hours/progress/risk/no-shows | Student and assigned school personnel | Cross-school membership and teacher-scope findings can violate this boundary. |
| Messages/interventions | Authorized participants and assigned staff | Legacy intervention and bulk-message routes grant school-wide teacher access. |
| LMS roster | Students in explicitly selected GoodHours courses | Current sync retrieves every visible course roster. |
| Audit records | Restricted security/privacy personnel | Current audit details duplicate identities and persistence is best effort. |
| Parent access | Valid guardian with scoped, revocable authorization | Bearer links require uniform lifecycle and operational verification. |

## 5.3 Required student-safety controls

- Default partner access to an event-scoped alias and only operational check-in fields.
- Replace the school-wide PII switch with recipient-, event-, purpose-, field-, approver-, and expiry-bound disclosure grants.
- Require explicit LMS course selection before retrieving any roster identity.
- Implement district-configurable retention for invitations, submissions, sessions, signups, messages, uploads, integration mappings, audit records, disabled users, exports, replicas, and backups.
- Implement verified contract-end export and purge, including subprocessors and backup expiration.
- Prohibit advertising, behavioral profiling, sale, or unrelated secondary use of student information.
- Provide school-controlled access, correction, export, deletion, legal-hold, and suspension workflows.
- Maintain a subprocessor inventory with exact student-data categories, purposes, locations, and retention.
- Record the school authorization and legitimate educational purpose for every external disclosure.
- Require step-up authentication for exports, disclosure changes, ownership transfer, and integrations.
- Establish a trained child-safety escalation process for harassment, grooming, self-harm, abuse, and inappropriate adult/student contact, including school notification and evidence preservation.

## 5.4 Encryption and breach containment

Verified in source:

- Integration credentials use authenticated field encryption.
- Production requires a field-encryption key.
- Passwords and major token classes are not stored in plaintext.

Not established by source:

- database-volume and backup encryption configuration
- managed key custody and separation of duties
- tested key rotation
- tested backup restoration and purge propagation
- tamper-evident audit export
- production database role separation
- geographic data residency
- incident notification timing and district contacts

# 6. SIS / SCHOOL PROCUREMENT AND COMPLIANCE ASSESSMENT

GoodHours processes school rosters and education records and will normally be reviewed as a student-data vendor even if it is not the district's authoritative SIS. Code can disprove a compliance claim, but source alone cannot establish contractual or legal compliance.

| Requirement | Status | Required evidence or remediation |
|---|---|---|
| FERPA | **Blocked** | Remediate school ownership, tenant membership, teacher scope, partner disclosure, and audit findings; execute a DPA defining school control, legitimate educational interest, disclosure limits, correction/export/deletion, redisclosure, and contract-end disposition. |
| COPPA for under-13 users | **Not demonstrated** | Define supported age range and school-consent/parental-consent model as applicable; provide direct notice, parent rights, minimum collection, no unrelated commercial use, and under-13 account handling. |
| PPRA | **Conditional / not demonstrated** | No covered survey primitive was established, but future protected-category surveys, sensitive profiling, or marketing research require school/parent procedures and feature gates. |
| ADA / Section 504 / public-school Title II | **Partial evidence only** | Complete manual keyboard, screen-reader, zoom/reflow, contrast, cognitive, motion, error, mobile, PDF, and email testing. |
| WCAG | **Not certified** | Adopt at least WCAG 2.1 AA and preferably WCAG 2.2 AA; maintain complete route/role coverage and remediation SLAs. |
| Section 508 / federal procurement | **Not demonstrated** | Publish a current VPAT/Accessibility Conformance Report covering the web app, generated documents, emails, and administrative workflows. |
| State student-privacy laws | **Not demonstrated** | Maintain a state/jurisdiction matrix and district DPAs covering security, breach notice, deletion, subprocessors, advertising/profiling, retention, and residency. |
| National Data Privacy Agreement | **Not demonstrated** | Provide privacy/security exhibits, data inventory, purpose limitation, retention, breach procedures, subprocessor terms, and deletion certification. |
| Security assurance | **Partial** | Source controls and clean dependency audits exist; schools may require SOC 2 Type II or equivalent evidence, independent penetration testing, secure-SDLC evidence, SBOM, and remediation SLAs. |
| Identity lifecycle | **Partial** | Google/password login exists; add district SAML/OIDC, MFA enforcement, SCIM/equivalent deprovisioning, session inventory, and emergency disablement. |
| Data retention/deletion | **Partial** | Account/export routes exist, but automated retention, contract-end purge, backup deletion, and independent deletion verification are not demonstrated. |
| Incident response | **Not demonstrated** | Provide a plan, 24/7 contact, severity/notification matrix, evidence preservation, tabletop results, and contractual notification commitments. |
| Business continuity/disaster recovery | **Not demonstrated** | Define/test RTO and RPO, backup frequency, regional failure response, restoration, and annual recovery exercises. |
| Vendor/subprocessor governance | **Not demonstrated** | Publish subprocessors, data categories, processing locations, contract flow-down, review cadence, and advance change notification. |
| Interoperability | **Partial** | Canvas/Google integrations exist but require security/minimization fixes; OneRoster, Ed-Fi, LTI, Clever, ClassLink, or other district-required support/certification was not evidenced. |
| Accessible documents | **Not demonstrated** | Verify generated PDFs are tagged with correct reading order/language and all non-web communications are accessible. |
| Payment security | **Partial** | Stripe-hosted workflows reduce payment-data scope; maintain the applicable PCI responsibility record and never store card data. |
| Cyber insurance/indemnity | **External evidence required** | Provide current certificates and district-acceptable contractual terms. |
| Public privacy policy/terms | **Legal review required** | Ensure notices match actual collection, disclosure, retention, subprocessors, minors handling, and school-directed processing. |
| AI use | **Policy required** | If AI is introduced, default-deny training/secondary use of student data, identify model providers/retention, require school approval, and provide human review. |
| CIPA-related concerns | **Shared school responsibility** | Support reporting, moderation, safe links/uploads, and school controls; the district retains broader network/content-filtering obligations. |
| HIPAA | **Not established as applicable** | Avoid health/disability data unless scope, contracts, authorization, and legal applicability are separately assessed. |
| International privacy | **Out of scope until market defined** | GDPR, UK GDPR, Canadian provincial, and other regimes need separate lawful-basis, transfer, residency, rights, and processor review. |

## Final disposition

- **Security architecture for real student use:** FAIL pending remediation
- **FERPA-ready technical posture:** FAIL pending remediation and contractual controls
- **COPPA readiness for under-13 users:** not demonstrated
- **ADA/WCAG compliance claim:** not supportable from current evidence
- **District procurement readiness:** not yet supportable
- **First customers using synthetic/demo data only:** conditionally possible if vulnerable integrations are disabled and the environment is clearly isolated
- **Real school claims or real student data:** HOLD
- **Required next security sequence:** remediate Findings 1–7, add failing regression tests first, run the five verification gates against an isolated database, then obtain independent security/accessibility/privacy procurement review.
