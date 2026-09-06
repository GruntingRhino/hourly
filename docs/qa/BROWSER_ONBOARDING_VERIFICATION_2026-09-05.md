# GoodHours Local Browser Onboarding + Redis Lua Verification — 2026-09-05

## Scope and safety

- Checkout: `/home/opc/RTB/projects/goodhours`
- Branch/HEAD at execution: `terra/fix-sol-findings-20260826` / `9c32bb6a84c9ac6f5e115e8e7bc250b2cdef03f2`
- Browser/API were local only: Vite `127.0.0.1:5173` → API `127.0.0.1:3001`, disposable PostgreSQL `127.0.0.1:5433/goodhours_test`.
- Playwright used the cached Chromium revision at `/home/opc/.cache/ms-playwright/chromium-1208/chrome-linux/chrome`; no browser download was performed.
- Browser tests used synthetic fixture data and intercepted onboarding API calls. No external email, Google credentials, provider callback, production endpoint, or production data was used.
- Redis verification used a disposable rootless Podman `redis:7-alpine` container on loopback port `6387`; it was removed after the test.

## Results

| Gate | Result | Evidence |
|---|---|---|
| Browser onboarding synthetic suite | **PASS** | `npx playwright test tests/onboarding-browser-verification.spec.ts`; **2 passed, 0 failed**, 6.7s |
| Student invitation UI | **PASS** | Unchecked 13+ control leaves Join Cohort disabled; checked state enables submit and payload contains `eligible13Plus: true`. |
| Beneficiary invitation UI | **PASS** | Unchecked 13+ control leaves Accept & Create Account disabled; checked state enables submit and payload contains `eligible13Plus: true`. |
| Beneficiary-admin invitation UI | **PASS** | Unchecked 13+ control leaves account creation disabled; checked state enables submit and payload contains `eligible13Plus: true`. |
| Age eligibility setup UI | **PASS** | Continue is disabled until checked; checked submission sent exactly `{ eligible13Plus: true }` to the mocked local endpoint. |
| School registration UI | **PASS** | Email/password registration traversed the real rendered steps; final verification action remained disabled before 13+ confirmation. |
| Actual source Lua against Redis | **PASS** | Extracted `decrementScript` from `server/src/middleware/rateLimit.ts` and executed it through Redis `EVAL`; exact-window isolation, nonnegative guard, missing-key no-recreation, expiry, and error-safe cases all passed. |
| Client lint/build | **PASS** | `npm run lint -- --max-warnings 0 && npm run build`; ESLint clean, Vite 416 modules, exit 0. |
| Canonical server suite after final change | **PASS** | Node 24 suite: **461 tests / 461 pass / 0 fail / 0 skip**, 72.2s. |
| Whitespace | **PASS** | `git diff --check`. |

## Defects fixed

The rendered onboarding pages previously allowed a valid-password form submit while the required age checkbox remained unchecked (server rejection was the only barrier on invitation forms; school registration similarly relied on the handler guard). The following controls now fail closed at the UI boundary while retaining server-side validation:

- `client/src/pages/AgeEligibility.tsx`
- `client/src/pages/student/JoinCohort.tsx`
- `client/src/pages/beneficiary/JoinBeneficiary.tsx`
- `client/src/pages/school/Register.tsx`

The beneficiary and student invitation pages also visibly submit the positive attestation only after the checkbox is checked. `tests/onboarding-browser-verification.spec.ts` is the executable synthetic regression suite.

## Redis Lua evidence

The actual Lua source from `rateLimit.ts` was run in a disposable Redis server, not a JavaScript substitute. Assertions verified:

- Releasing an old-window key does not alter the new-window key.
- Repeated release never decrements below zero.
- Missing keys return zero and are not recreated.
- Expired keys return zero and remain absent.
- Non-numeric/negative counter values return zero without unsafe decrement.

This closes the local executable Redis/Lua gap only. It is not evidence of Upstash production configuration, deployed provider routing, multi-instance deployment behavior, or provider latency/failure characteristics.

## Coverage remaining

- The synthetic suite does not establish real Google OAuth, Google Classroom, Canvas, or external email delivery.
- Existing-account login redirect, pending-school confirmation, and real database invitation persistence/reload were covered by server tests and remain separate from this mocked browser suite; they were not claimed as browser-provider evidence here.
- No deployment, production visit, commit, push, or deploy was performed.
- Existing independent review blockers remain, including the root dependency audit residual and deployment/provider provenance gates.

No screenshots were generated because the suite passed; Playwright was configured with screenshots off and synthetic logs contained no secrets or raw tokens.
