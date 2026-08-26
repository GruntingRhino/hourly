# Dependency advisory exceptions

## GHSA-qwww-vcr4-c8h2 — React Router RSC-mode CSRF bypass

- **Recorded:** 2026-07-31
- **Affected audit range:** `react-router >=7.12.0 <8.3.0`
- **Installed production dependency:** `react-router-dom@7.18.2` → `react-router@7.18.2`
- **Severity reported by npm:** high
- **Disposition:** non-applicable to the shipped GoodHours browser SPA; this is not a clean `npm audit` result.

### Applicability proof

The advisory is scoped to React Router's RSC mode. GoodHours is a client-only Vite SPA:

1. `client/src/App.tsx` uses `<BrowserRouter>`.
2. `client/package-lock.json` contains neither `react-server-dom-webpack` nor `@react-router/dev`.
3. Source contains none of `react-router-dom/server`, `react-router/dom`, `react-server-dom`, `HydratedRouter`, `RouterProvider`, or `ServerRouter`.
4. `npm run security:verify-no-rsc` enforces all of the above and fails if RSC dependencies or APIs are introduced.
5. `npm run security:verify-react-router-rsc-advisory` fails if production `npm audit` reports anything other than this documented finding.

### Upstream remediation

`npm audit` identifies `8.3.0` as the first patched version, but `react-router-dom@8.3.0` is not published to npm as of the recorded date. Downgrading to `7.11.0` solely to make `npm audit` green is not an acceptable remediation.

### Recheck trigger and expiry

Recheck when a patched stable version becomes available, on every React Router upgrade, and no later than 2026-08-31. Remove this exception only after a clean production dependency audit or a replacement applicability analysis.

## GHSA-ggr8-5vv4-36mx — deepmerge-ts stack exhaustion — RESOLVED 2026-08-26

- **Affected audit range:** `deepmerge-ts <8.0.0`
- **Previously installed:** `deepmerge-ts@7.1.5` via `prisma@6.19.3` → `@prisma/config@6.19.3`
- **Severity reported by npm:** high (3 findings: deepmerge-ts, @prisma/config, prisma)
- **Disposition:** RESOLVED via npm `overrides` pin, not an exception.

`npm audit fix --force` proposes installing `prisma@6.12.0`, a breaking
downgrade of a core dependency — rejected per audit policy. Instead,
`server/package.json` now pins:

```json
"overrides": { "deepmerge-ts": "8.0.2" }
```

Compatibility evidence: `@prisma/config` uses exactly one API from
deepmerge-ts (`const { deepmerge } = await import("deepmerge-ts")`, passed as
c12's `merger`), and 8.0.2 ships dual ESM/CJS builds, so the dynamic import
keeps working. Verified after reinstall:

- `npm ls`: lockfile resolves `node_modules/deepmerge-ts` → `8.0.2`
- `npx prisma --version`, `npx prisma generate`, `npx prisma validate`,
  `npx prisma migrate status`, both `prisma migrate diff` directions: PASS
- server build PASS; full suite **431 tests / 430 pass / 0 fail / 1 skip**
- `NODE_ENV=development npm audit`: **0 vulnerabilities**

Recheck on every Prisma major upgrade; remove the override once `@prisma/config`
declares `deepmerge-ts >=8.0.0` natively.

