# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GoodHours** is a community service coordination, tracking, and verification platform — the system of record for student volunteer hours. It connects students, service organizations, and schools with a trusted platform for tracking, verifying, and reporting community service hours.

Core priorities (in order): Legitimacy > Verification > Compliance > Adoption.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + React Router v6
- **Backend**: Express + TypeScript + Prisma ORM
- **Database**: SQLite (dev), designed for PostgreSQL in production
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Validation**: Zod (server-side)

## Build & Run Commands

### Server (`/server`)
```bash
cd server
npm install
npx prisma db push          # Apply schema to database
npx tsx prisma/seed.ts       # Seed with test data
npm run dev                  # Start dev server on :3001 (tsx watch)
npx tsc --noEmit             # Type check
```

### Client (`/client`)
```bash
cd client
npm install
npm run dev                  # Start dev server on :5173 (proxies /api to :3001)
npx tsc --noEmit             # Type check
npx vite build               # Production build
```

### Both (run in separate terminals)
```bash
cd server && npm run dev     # Terminal 1
cd client && npm run dev     # Terminal 2
```

### Database
```bash
cd server
npx prisma db push           # Push schema changes (dev)
npx prisma migrate dev       # Create migration (when ready for prod)
npx prisma studio            # Visual database browser
npx tsx prisma/seed.ts       # Re-seed (drops and recreates data)
```

### Test Accounts (after seeding)
| Role         | Email                       | Password     |
|--------------|-----------------------------|-------------|
| Student      | john@student.edu            | password123 |
| Student      | jane@student.edu            | password123 |
| Student      | alex@student.edu            | password123 |
| Organization | volunteer@greenearth.org    | password123 |
| Organization | staff@library.org           | password123 |
| School Admin | admin@lincoln.edu           | password123 |

## Architecture

### Server (`/server/src/`)
- `index.ts` — Express app entry point, route mounting
- `routes/` — API route handlers, one file per domain
  - `auth.ts` — signup, login, profile (JWT-based)
  - `opportunities.ts` — CRUD for service opportunities
  - `signups.ts` — student signup with capacity/waitlist
  - `sessions.ts` — check-in/check-out, session listing per role
  - `verification.ts` — approve/reject state machine with audit trail
  - `organizations.ts` — org profiles, volunteer history, stats
  - `schools.ts` — student management, groups, org approvals, stats
  - `messages.ts` — messaging + notifications
  - `reports.ts` — student/org/school reports, CSV export, audit logs
  - `saved.ts` — save/skip/discard opportunities
- `middleware/auth.ts` — JWT authentication, token signing
- `middleware/rbac.ts` — `requireRole()` middleware
- `lib/prisma.ts` — Prisma client singleton
- `prisma/schema.prisma` — Complete database schema

### Client (`/client/src/`)
- `App.tsx` — Router setup with role-based route rendering
- `hooks/useAuth.tsx` — Auth context (login, signup, logout, token management)
- `lib/api.ts` — API client with JWT header injection
- `components/Layout.tsx` — Authenticated layout with role-based nav
- `pages/` — Page components organized by role
  - `Landing.tsx`, `Login.tsx`, `Signup.tsx` — Public pages
  - `student/` — Dashboard, Browse, OpportunityDetail, Messages, Settings
  - `organization/` — Dashboard, Opportunities, CreateOpportunity, Messages, Settings
  - `school/` — Dashboard, Groups, Messages, Settings

### API Routes (all under `/api`)
- `POST /api/auth/signup` — Create account (role selection)
- `POST /api/auth/login` — Login, returns JWT
- `GET /api/auth/me` — Current user profile
- `GET /api/opportunities` — Browse (supports `?search=`, `?organizationId=`, `?date=`, `?status=`)
- `POST /api/opportunities` — Create (org only)
- `POST /api/signups` — Sign up for opportunity (student, with capacity/waitlist)
- `POST /api/sessions/:id/checkin` — Check in (student)
- `POST /api/sessions/:id/checkout` — Check out (student, auto-calculates hours)
- `POST /api/verification/:sessionId/approve` — Approve hours (org/school)
- `POST /api/verification/:sessionId/reject` — Reject hours with reason
- `GET /api/reports/student` — Student hour summary
- `GET /api/reports/export/csv` — CSV export

### Domain Model & Key Invariants
- **Verification state machine**: PENDING_CHECKIN → CHECKED_IN → CHECKED_OUT → VERIFIED/REJECTED
- Service hours are **immutable once verified** — students cannot edit raw time data
- All hours tied to: real student, real org, real opportunity, real time/place, named verifier
- Permissions enforced **server-side** via `requireRole()` middleware
- Capacity enforcement with automatic **waitlist promotion** on cancellation
- **Immutable audit trail** for all verification actions

## Screen Reference Convention

Files in `/screens` follow this naming:
- `0`, `1`, `2`, `3` prefix = authentication/onboarding flows
- `#a` suffix = student-facing features
- `#b` suffix = organization-facing features
- `#c` suffix = school/admin-facing features
- Layout is NOT authoritative; **functional presence IS authoritative**
