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
