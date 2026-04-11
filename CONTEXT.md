# GoodHours — AI Context Document

## What is GoodHours?

GoodHours is a **school-orchestrated community service tracking platform** — the system of record for student volunteer hours. It connects students, beneficiary organizations (nonprofits/service orgs), and schools in a trusted, verified workflow for logging, approving, and reporting community service.

**Core priorities (in order):** Legitimacy > Verification > Compliance > Adoption

**Live URL:** https://goodhours.app

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS + React Router v6 |
| Backend | Express 4 + TypeScript |
| ORM | Prisma 6 + Neon serverless adapter |
| Database | PostgreSQL (Neon) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod (server-side) |
| Email | Resend (`notifications.goodhours.app`) |
| Deployment | Vercel (SPA + serverless function) |
| Maps | Leaflet + React Leaflet |
| PDF | jsPDF + jsPDF-AutoTable |

---

## Architecture Overview

```
/
├── api/index.ts               # Vercel serverless entry (re-exports Express app)
├── server/src/                # Express backend
│   ├── index.ts               # App bootstrap, route mounting
│   ├── routes/                # API route handlers (~18 files)
│   ├── middleware/auth.ts     # JWT verification
│   ├── middleware/rbac.ts     # requireRole() middleware
│   ├── lib/prisma.ts          # Prisma client singleton
│   └── services/              # Email service
├── server/prisma/schema.prisma # Full database schema
├── client/src/                # React frontend
│   ├── App.tsx                # Router (role-gated routes)
│   ├── hooks/useAuth.tsx      # Auth context (login/signup/logout)
│   ├── lib/api.ts             # API client (injects JWT header)
│   ├── components/Layout.tsx  # Authenticated shell with nav
│   └── pages/                 # Page components by role
└── vercel.json                # Build + rewrite config
```

**Deployment:** Client builds to `client/dist/` (static SPA). All `/api/*` routes proxied to the Express serverless function at `api/index.ts`. Database uses Neon serverless PostgreSQL.

---

## Roles & Permissions

| Role | Description |
|---|---|
| `SCHOOL_ADMIN` | Creates cohorts, manages students, approves beneficiaries, reviews self-submitted hours |
| `TEACHER` | Read access to school data; same view as school admin (limited write) |
| `DISTRICT_ADMIN` | Cross-school visibility |
| `STUDENT` | Browses opportunities, signs up for time slots, self-submits hours |
| `BENEFICIARY_ADMIN` | Creates volunteer opportunities/time slots, approves student attendance |
| `ORG_ADMIN` | Legacy role (backward compatibility) |

Permissions are enforced **server-side** via `requireRole()` middleware on every route.

---

## Domain Model

### Key Entities (Current Architecture)

**School**
- Central security boundary; all student/beneficiary data is scoped to a school
- Has `requiredHours`, verified email domains, service area zip codes
- Registers via Google OAuth or email/password; domain verified via TXT DNS record

**Cohort**
- A class/group of students within a school (replaces legacy `Classroom`)
- States: DRAFT → PUBLISHED → ARCHIVED
- Students join via invitation tokens (`StudentInvitation`)

**Beneficiary**
- Volunteer organizations/nonprofits (replaces legacy `Organization`)
- Can be from IRS 501c3 directory (`BeneficiaryDirectory`) or manually created
- Must be approved by a school (`SchoolBeneficiaryApproval`) to partner
- Join via invitation tokens (`BeneficiaryInvitation`)

**BeneficiaryOpportunity + BeneficiaryTimeSlot**
- Opportunities have date ranges, locations, custom fields
- Time slots are specific sessions with date/time/capacity
- Students sign up for time slots (`BeneficiarySignup`)

**BeneficiarySignup**
- The attendance record: student ↔ time slot
- States: PENDING → CHECKED_IN → CHECKED_OUT → APPROVED / REJECTED
- Beneficiary admin approves + sets actual hours worked

**SelfSubmittedRequest**
- Student self-reports hours for volunteering not in the system
- School admin approves or rejects with a reason

**ServiceSession** (legacy)
- Attendance record for legacy `Opportunity` / `Signup` flow
- Verification state machine: PENDING_CHECKIN → CHECKED_IN → CHECKED_OUT → VERIFIED / REJECTED

**AuditLog / BeneficiaryAuditLog / DataAccessLog**
- Immutable append-only logs for all verification actions and FERPA compliance

---

## API Routes Summary

All routes are under `/api/`.

### Auth (`/api/auth/`)
- `POST /signup` — Create account
- `POST /login` — JWT login
- `GET /me` — Current user profile
- `PUT /password` — Change password
- `GET /verify-email` — Email verification
- `POST /forgot-password` / `POST /reset-password` — Password reset
- `POST /google/callback` — Google OAuth
- `POST /google/register-school` — School registration via Google

### Cohorts (`/api/cohorts/`)
- `GET /` — List cohorts with student counts + hour summaries
- `POST /` — Create cohort (SCHOOL_ADMIN)
- `GET /:id` — Cohort detail with roster
- `POST /:id/import` — CSV import students
- `POST /:id/publish` — Publish for enrollment
- `POST /:id/add-student` — Add individual student

### Beneficiaries (`/api/beneficiaries/`)
- `GET /directory` — Browse IRS/public beneficiary directory
- `GET /directory/nearby` — Nearby beneficiaries (geocoded)
- `POST /:id/invite` — School invites beneficiary to partner
- `POST /:id/approve` — School approves beneficiary
- `POST /:id/opportunities` — Beneficiary creates opportunity
- `POST /slots/:slotId/signup` — Student signs up for time slot (STUDENT)
- `POST /signups/:signupId/approve` — Beneficiary approves attendance + hours
- `POST /signups/:signupId/reject` — Beneficiary rejects signup

### Self-Submitted Hours (`/api/self-submissions/`)
- `POST /` — Student submits hours (STUDENT)
- `GET /` — List submissions (role-filtered)
- `PATCH /:id/approve` / `PATCH /:id/reject` — School reviews

### Invitations (`/api/invitations/`)
- `GET /student?token=` / `POST /student/accept` — Student joins cohort
- `GET /beneficiary?token=` / `POST /beneficiary/accept` — Beneficiary joins school

### Schools (`/api/schools/`)
- `GET /settings` / `PUT /settings` — School configuration
- Domain verification endpoints

### Reports (`/api/reports/`)
- `GET /student` — Student hour summary (FERPA-logged)
- `GET /school` — School-wide aggregated report
- `GET /school/csv` — CSV export

### Other
- `GET /api/geocode?address=` — Server-side Nominatim proxy
- `GET /api/health` — Health check

---

## Client Routing

### Public Routes
- `/` — Landing
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/school/register`, `/school/verify-registration`
- `/join/student?token=` — Accept student invitation
- `/join/beneficiary?token=` — Accept beneficiary invitation

### Student Routes
- `/dashboard` — Hours progress, upcoming slots
- `/browse` — Search available opportunities
- `/opportunity/:id` — Opportunity detail
- `/slot/:id` — Time slot detail + signup
- `/submit` — Self-submit hours form
- `/messages`, `/settings`

### School Admin Routes
- `/dashboard` — Cohort stats, student progress summary
- `/students` — Full student roster
- `/cohorts`, `/cohorts/:id` — Cohort management
- `/beneficiaries` (alias `/partners`) — Approved partners
- `/discover` — Browse beneficiary directory
- `/submissions` — Review self-submitted hours
- `/messages`, `/settings`

### Beneficiary Admin Routes
- `/dashboard` — Signup stats, opportunity summary
- `/opportunities` — Create/manage opportunities + time slots
- `/settings` — Profile, partner schools, invitations

---

## Auth System

**Server:** `authenticate` middleware validates Bearer JWT on every protected route. Token payload: `{ userId, email, role }`. Default expiry: 7 days.

**Client:** `useAuth` React context. Token stored in `localStorage` as `goodhours_token`. User profile cached as `goodhours_user`. On app load, validates token via `GET /api/auth/me`. Exported: `login()`, `signup()`, `logout()`, `refreshUser()`, `loginWithToken()`.

---

## Key Workflows

### School Onboarding
1. School admin registers via `/school/register` (Google OAuth or email/password)
2. Verifies domain via magic link or DNS TXT record
3. Creates cohorts, imports student CSV
4. Students receive invitation emails → accept via `/join/student?token=`

### Beneficiary Onboarding
1. School discovers beneficiary in directory (`/discover`) or adds manually
2. School sends invitation → beneficiary receives email
3. Beneficiary accepts via `/join/beneficiary?token=` → creates account
4. School approves partnership

### Student Service Hours
**Path A — Structured (Beneficiary-created):**
1. Student browses opportunities, signs up for a time slot
2. Student checks in/out (tracked by beneficiary)
3. Beneficiary admin approves hours

**Path B — Self-Submitted:**
1. Student submits hours form with org name, date, description, evidence
2. School admin reviews and approves/rejects

### Verification State Machine
`PENDING → CHECKED_IN → CHECKED_OUT → APPROVED / REJECTED`
Hours are immutable once approved. All actions logged in audit trail.

---

## Compliance & Security

- **FERPA:** All student data access is logged in `DataAccessLog`
- **Rate limiting:** Signup (5/hr), login (5/15min), password reset (5/15min), resend verification (3/hr)
- **RBAC:** Every API route enforces role via `requireRole()` middleware
- **Audit trail:** `AuditLog` and `BeneficiaryAuditLog` are append-only
- **Immutability:** Verified hours cannot be edited by students
- **Domain verification:** Schools must verify email domain ownership

---

## Development

### Commands
```bash
# Server (port 3001)
cd server && npm run dev       # tsx watch
npx prisma db push             # Apply schema
npx tsx prisma/seed.ts         # Seed test data
npx tsc --noEmit               # Type check

# Client (port 5173, proxies /api to 3001)
cd client && npm run dev
npx tsc --noEmit
npx vite build
```

### Test Accounts (after seeding)
| Role | Email | Password |
|---|---|---|
| Student | john@student.edu | password123 |
| School Admin | admin@lincoln.edu | password123 |
| Beneficiary Admin | volunteer@greenearth.org | password123 |

### Environment Variables
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — Token signing secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth (from `google_oAuth_secrets.json` in dev)
- `RESEND_API_KEY` — Email sending
- `EMAIL_FROM` — `GoodHours <noreply@notifications.goodhours.app>`

---

## File Map (Key Files)

```
server/prisma/schema.prisma              # Full data model
server/src/index.ts                      # Express app, route mounting
server/src/middleware/auth.ts            # JWT authentication
server/src/middleware/rbac.ts            # requireRole() RBAC
server/src/routes/auth.ts               # Auth endpoints
server/src/routes/cohorts.ts            # Cohort management
server/src/routes/beneficiaries.ts      # Beneficiary + opportunities + signups
server/src/routes/schools.ts            # School settings + domain verification
server/src/routes/self-submissions.ts   # Self-submitted hours
server/src/routes/sessions.ts           # Legacy check-in/out
server/src/routes/reports.ts            # Reporting + CSV export
server/src/routes/messages.ts           # Messaging + notifications
client/src/App.tsx                       # React Router (all routes)
client/src/hooks/useAuth.tsx            # Auth context
client/src/lib/api.ts                   # API client (JWT injection)
client/src/pages/student/               # Student UI (8 pages)
client/src/pages/school/                # School admin UI (11 pages)
client/src/pages/beneficiary/           # Beneficiary UI (4 pages)
vercel.json                             # Deployment config
api/index.ts                            # Serverless entry point
```
