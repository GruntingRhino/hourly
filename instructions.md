You are Claude Code CLI acting as a senior full-stack engineer.

Your task is to BEGIN BUILDING an application called **Hourly** based on the specification below.  
Do not summarize. Do not ask high-level questions. Default to reasonable technical decisions when unspecified.

## Project Context

Hourly is a **community service coordination, tracking, and verification platform** for students, service organizations, and schools. It is the **system of record for student volunteer hours**.

The goal is to build production-quality foundations, not mockups.

Trust, verification, and compliance are higher priority than visual polish.

---

## How to Interpret Screenshots

- Screens are located in `/screens`
- Filenames beginning with `0`, `1`, `2`, `3` = authentication / onboarding flows
- Filenames with:
  - `#a` → student-facing features
  - `#b` → organization-facing features
  - `#c` → school / admin-facing features
- Layout is NOT authoritative
- Presence of functionality IS authoritative

If a function exists in the spec, it must exist in the app even if the UI differs.

---

## What You Should Build First (Mandatory)

Immediately scaffold the following:

1. **Project structure**
   - Frontend
   - Backend API
   - Database schema
   - Auth system
   - Role-based access control

2. **Core domain models**
   - User (student, organization, school/admin)
   - Organization
   - Opportunity
   - Signup
   - ServiceSession
   - Verification / AuditLog

3. **Authentication & Roles**
   - Email-based auth
   - Role assignment
   - School affiliation for students
   - Organization approval by schools

4. **Opportunity lifecycle**
   - Create / edit / cancel opportunities (organizations)
   - Discover and view opportunities (students)
   - Signup with capacity enforcement

5. **Attendance & verification**
   - Check-in / check-out
   - Time-window enforcement
   - Verification state machine (pending / approved / rejected)
   - Immutable audit trail

6. **Records & reporting**
   - Student service history
   - Organization volunteer logs
   - School audit views
   - Exportable reports (CSV/PDF placeholders acceptable)

---

## Technical Expectations

- Use clear, conventional architecture
- Prefer explicit data models over magic
- Enforce permissions server-side
- Treat service hours as immutable once verified
- Build with scalability and multi-school support in mind

You may choose the stack, but you must:
- Explain your choices briefly
- Keep frontend and backend cleanly separated
- Use migrations for schema changes

---

## Output Instructions

Proceed in this order:

1. Describe chosen tech stack
2. Create folder structure
3. Define database schema
4. Implement authentication & RBAC
5. Implement core APIs
6. Implement basic frontend pages for each role
7. Wire screenshots conceptually to routes

Do NOT stop after scaffolding.
Do NOT wait for confirmation.
Continue building until a usable end-to-end flow exists.

---

Begin now.
