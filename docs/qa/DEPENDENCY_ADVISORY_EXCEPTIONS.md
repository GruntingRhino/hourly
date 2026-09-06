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

## GHSA-px8p-9vwx-vf98 — fflate malformed ZIP64 denial of service — RESOLVED 2026-09-04

- **Affected dependency:** `fflate@0.8.2` via `jspdf@4.2.1`
- **Severity reported by npm:** moderate
- **Disposition:** RESOLVED via npm `overrides` pin, not an exception.

`client/package.json` now pins `fflate` to `0.8.3`, the patched release compatible with
`jspdf@4.2.1`; `client/package-lock.json` resolves the transitive package to `0.8.3`.
Verified with `npm ls fflate --all`, client build, and offline `npm audit --audit-level=high`:
`found 0 vulnerabilities`. The online audit endpoint was unavailable during this run,
so it remains a follow-up verification item when npm audit networking is healthy.

Recheck on every jsPDF upgrade and whenever npm reports a new fflate advisory.

## 2026-09-05 final integration verification

See `docs/qa/DEPENDENCY_FINAL_REMEDIATION_2026-09-05.md` for the complete evidence record.

- Runtime used for release gates: Node `v24.20.0`, npm `11.19.0`.
- The isolated candidate's global `path-to-regexp: 8.4.2` override was rejected: Express `4.22.2` declares `~0.1.12` and the actual installed Express runtime copy remains `0.1.13`. Integrated selectors upgrade only Vercel 8.x/6.x consumers (`8.4.2`/`6.3.0`) and preserve Express.
- Actual root tree: `npm ls --all --json` exit 0 with no problems. `tar@7.5.22`, `@tootallnate/once@2.0.1`, `smol-toml@1.6.1`, `ajv@8.18.0`, `js-yaml@4.3.2`, root `minimatch@10.2.6` with `@ts-morph/common` minimatch `3.1.5`, and version-selective `path-to-regexp` were verified from installed package metadata.
- Root online audit: **10 residual vulnerabilities: 9 moderate, 1 high, 0 critical**. Residuals are in the Vercel CLI/build graph and `undici` 5.x; this is not a clean root audit.
- Server online audit: **0 vulnerabilities**. Client online audit: **0 vulnerabilities**.
- Server suite: **461 tests / 461 pass / 0 fail / 0 skip**. Server build, client lint/build, Prisma validate, and both live/shadow migration diffs passed.
- Actual compiled server boot and HTTP smoke passed: health `200` with DB `ok`, JSON 404, and unauthenticated auth `401`. Vercel CLI `59.11.7` version/help and local builder API imports passed.

`undici` was intentionally not forced from Vercel's 5.x contract to 6.x; npm registry inspection found `5.29.0` as the last 5.x release while the affected fixes require 6.x. Recheck root Vercel advisories on each CLI release and before deployment; do not use `npm audit fix --force` or blanket cross-major overrides.
