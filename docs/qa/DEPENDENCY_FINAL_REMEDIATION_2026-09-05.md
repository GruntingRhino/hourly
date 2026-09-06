# Dependency final remediation evidence — 2026-09-05

## Scope and safety boundary

- Checkout: `/home/opc/RTB/projects/goodhours`
- Branch: `terra/fix-sol-findings-20260826`
- HEAD observed: `9c32bb6a84c9ac6f5e115e8e7bc250b2cdef03f2`
- Runtime: Node `v24.20.0`, npm `11.19.0`
- No commit, push, deploy, reset, stash, branch switch, production database, production environment, or secret output was used.
- Existing dirty and untracked work was preserved. This dependency integration changed only the root manifest/lock and this evidence update.

The isolated candidate's global `path-to-regexp: 8.4.2` override was **rejected as unsafe** for integration. Express `4.22.2` declares `path-to-regexp: ~0.1.12` and its installed runtime copy is `0.1.13`; replacing it with the 8.x API would break Express's legacy function contract. The candidate's claim that all consumers were same-major was false. The integrated override is version-selective:

```json
"path-to-regexp@8.3.0": "8.4.2",
"path-to-regexp@8.2.0": "8.4.2",
"path-to-regexp@6.1.0": "6.3.0"
```

This leaves Express's `0.1.13` copy intact, upgrades Vercel 8.x consumers to `8.4.2`, and upgrades Vercel Node/Remix 6.x consumers to `6.3.0`. The root 8.x package and Vercel's `path-to-regexp-updated` alias were separately inspected. The old minimatch 3.x consumer under `@ts-morph/common` is also preserved; only the Vercel 10.x consumer is selected for `10.2.6`.

## Integrated remediation

Root `package.json` and `package-lock.json` now apply same-major or consumer-scoped pins:

| Package | Integrated resolution | Scope / compatibility evidence |
|---|---:|---|
| `tar` | `7.5.22` | Vercel consumers are 7.x; above critical affected `<=7.5.20` |
| `@tootallnate/once` | `2.0.1` | Vercel consumer is 2.x |
| `smol-toml` | `1.6.1` | Vercel Python/Rust consumers are 1.x |
| `ajv` | `8.18.0` | Vercel static-config consumer is 8.x |
| `js-yaml` | `4.3.2` | Vercel Python-analysis consumer is 4.x |
| `minimatch` | `10.2.6` | selected for Vercel 10.x; `@ts-morph/common` remains `3.1.5` |
| `path-to-regexp` | `8.4.2`, `6.3.0`, `0.1.13` | version-selective; Express 4 runtime preserved |
| `deepmerge-ts` | `8.0.2` | pre-existing Prisma-compatible override preserved |
| `qs` | `6.16.0` | pre-existing Express/body-parser-compatible override preserved |

`undici` was not forced from Vercel's 5.x contract to 6.x. Registry inspection showed `5.29.0` is the last 5.x release while the affected fixes require 6.x; this remains an explicitly documented Vercel build-tool residual.

## Actual installed-tree and consumer verification

- `npm install --package-lock-only --ignore-scripts --no-audit`: PASS.
- `npm install --no-audit` with the root `postinstall` observed and run: PASS; Prisma Client generated at both root and server output paths.
- Root `npm ls --all --json`: PASS, exit 0, `problems: []`.
- Installed resolutions: Express `4.22.2` → `express/node_modules/path-to-regexp@0.1.13`; root `path-to-regexp@8.4.2`; `@vercel/node/node_modules/path-to-regexp@6.3.0`; `@ts-morph/common/node_modules/minimatch@3.1.5`; root `minimatch@10.2.6`; `tar@7.5.22`; `ajv@8.18.0`; `js-yaml@4.3.2`; `@tootallnate/once@2.0.1`.
- `server/src/index.ts` actual boot from compiled `server/dist/index.js` against disposable PostgreSQL: PASS.
- HTTP smoke: `GET /api/health` **200** with `{status:"ok",db:"ok"}`; unknown route **404 JSON**; unauthenticated `/api/auth/me` **401**.
- Express runtime route smoke with a real `/:id` route: **200 `ok`**. This exercises the Express runtime rather than only CLI help.
- Vercel CLI: `npx vercel --version` **59.11.7**, `npx vercel --help` exit 0. Local `require()` API probes for `@vercel/node`, `@vercel/backends`, and `@vercel/express` all succeeded. No deploy, pull, or external project access was attempted.

## Fresh gates after integration

| Gate | Result | Exact evidence |
|---|---|---|
| Server full suite | PASS | **461 tests / 461 pass / 0 fail / 0 skip**, 71.254s |
| Server build | PASS | `npm run build`, `tsc` exit 0 |
| Client lint | PASS | `npm run lint -- --max-warnings 0`, exit 0 |
| Client build | PASS | Vite `7.3.6`, 416 modules, exit 0 |
| Root online audit | RESIDUAL | **10 total: 9 moderate, 1 high, 0 critical** |
| Server online audit | PASS | **0 vulnerabilities** |
| Client online audit | PASS | **0 vulnerabilities** |
| Prisma validate | PASS | schema valid |
| Live migration diff | PASS | exit 0, 2-line empty/status output |
| Fresh migrations/shadow diff | PASS | exit 0, 2-line empty/status output |

The root audit's machine-readable metadata is the authoritative count: **10 total = 9 moderate + 1 high; 0 info, 0 low, 0 critical**. The residual nodes are the Vercel CLI/build graph (`vercel`, `@vercel/node`, framework adapters) and `undici` 5.x. They are not application Express runtime findings, but root tooling exposure remains open.

The root audit exited non-zero because these residual advisories remain; it is not a clean root audit claim. Recheck on every Vercel CLI release and do not use `npm audit fix --force` or blanket cross-major overrides.

## Changed paths

- `package.json`
- `package-lock.json`
- `docs/qa/DEPENDENCY_FINAL_REMEDIATION_2026-09-05.md`
- `docs/qa/DEPENDENCY_ADVISORY_EXCEPTIONS.md`
- `docs/qa/SECURITY_AUDIT_2026-09-05.md`
