# GoodHours launch verification — 2026-08-30

## Candidate and reconciliation

- Authorized checkout: `/home/abhay/Hermes/RTB/apps/GoodHours` on PC WSL host `GODPC`.
- GitHub remote: `GruntingRhino/Hourly.git`.
- GitHub `origin/main` was force-updated during sync to `937301d`; local stale `main` work was preserved as `backup/local-main-before-reconcile-20260830`.
- `origin/dev` was six commits ahead of `origin/main` and had no divergence on the main side (`git rev-list --left-right --count origin/main...origin/dev` = `0 6`).
- Local `main` was fast-forwarded from `937301d` to `cd9a9ce` (the verified security/remediation line). No production push or deploy was performed.
- Untracked operator files `OPERATOR_INTEL.md` and `docs/legacy-prepublish-checklist.md` were preserved and not included.

## Code/security disposition

- SOL-01 milestone-report cross-school IDOR: FIXED in `cd9a9ce`; `GET /api/reports/student/milestones` uses central staff scope plus cohort-aware access assertion before loading the target student.
- SOL-02 OAuth replay/browser binding: implemented on the reconciled dev line for Canvas and Google Classroom using persisted hashed state, expiry, atomic conditional claim, HttpOnly binding cookie, and callback-time active school-admin recheck. Behavioral helper coverage is present; provider sandbox callback remains externally blocked.
- SOL-03 tracked test encryption key: removed from `server/.env.test` in the reconciled line. Production-like validation remains fail-closed.
- Static review: no tracked private key or non-example `.env` file found; only example/test env files are tracked. `git diff --check`: PASS.

## Local gates (disposable PostgreSQL database only)

- Focused OAuth security test: PASS — TAP `1..3`, pass 3, fail 0.
- Full server suite: PASS — TAP `1..436`, pass 435, fail 0, skipped 1; 9.05s. Command used an explicit loopback disposable DB and set both `DATABASE_URL` and `DEV_DATABASE_URL` to avoid the repository `.env` development override.
- Server build: PASS — `npm run build` / `tsc` exit 0.
- Client build: PASS — Vite transformed 414 modules and built successfully.
- Dependency audits: PASS — server and client `npm audit --audit-level=high`, 0 vulnerabilities.
- Prisma validation/status: PASS — schema valid; 64 migrations found; database up to date.
- Live migration diff: PASS — empty migration.
- Fresh migrations-replayed shadow diff: PASS — empty migration.

## Staging HTTP smoke checks

Target: `https://hourly-dev.vercel.app` (staging/preview only).

- Health: PASS — `GET /api/health` HTTP 200, `{"status":"ok","db":"ok",...}`.
- Auth boundary: BLOCKED for candidate verification — `GET /api/reports/student/milestones` returned HTTP 404 `{"error":"Not found"}`, indicating the staging deployment does not expose the reconciled route (not a successful auth-boundary proof).
- Signup boundary: PASS — invalid payload to `POST /api/auth/signup` returned HTTP 400 `{"error":"Invalid email"}`; no account was created.
- Public read path: PASS — `GET /api/opportunities?limit=1` returned HTTP 200 with JSON opportunity data.
- Root app: PASS — HTTP 200 HTML.
- Vercel administration/deploy verification: BLOCKED — authorized Mac `100.120.194.41` was unreachable by SSH (connection timeout). No Vercel credentials were accessed or printed, and no deployment was attempted.

## Remaining blockers

- BLOCKED: staging must be redeployed from the reconciled candidate before a real protected-route auth check and signup/read authenticated flow can be claimed.
- BLOCKED: Canvas/Google Classroom provider sandbox and external email/pilot/legal validation were not performed. No FERPA/COPPA compliance claim is made.
- BLOCKED: promotion to GitHub `main` is intentionally withheld because this branch is the deploy/prod line and the instruction forbids production deployment. The reconciled candidate is available locally at `cd9a9ce` and already exists on `origin/dev`.
