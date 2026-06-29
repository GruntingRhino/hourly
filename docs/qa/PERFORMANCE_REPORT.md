# GoodHours — Performance Report

**Date:** 2026-06-29  
**Environment:** Local dev (PostgreSQL `goodhours_qa_latest`, server :3001, client :5173)  
**Auditor:** Claude Code QA Automation  

---

## Executive Summary

**Result: PASS for pilot scale. Bundle size requires post-pilot attention.**

API response times are excellent (1–6ms on local dev). Production latency will be higher due to network, connection pooling, and TLS overhead, but the query patterns are efficient with proper Prisma `include` usage and no N+1 patterns found. The client bundle has one oversized chunk that should be split before general availability.

---

## API Latency Results

All measurements taken with a warm server on localhost. Production latency will be 20–100ms higher depending on hosting and geography.

| Endpoint | Local Latency | Notes |
|---|---|---|
| `GET /api/auth/me` | 3ms | Single User lookup by userId |
| `GET /api/opportunities` | 3ms | Filtered list with includes |
| `GET /api/sessions` | 1ms | Role-filtered session list |
| `GET /api/reports/student` | 6ms | Aggregation across sessions |
| `GET /api/health` | 1ms | DB ping now included (SELECT 1) |

**All endpoints well under the 200ms target for interactive UI responses.**

---

## Client Bundle Size Analysis

Build command: `npx vite build --mode production`

| Chunk | Raw Size | Gzip Size | Status |
|---|---|---|---|
| `index.html` | 0.97 KB | 0.53 KB | ✅ |
| `index.css` (Tailwind) | 70.46 KB | 16.89 KB | ✅ |
| `purify.es.js` (DOMPurify) | 25.13 KB | 9.45 KB | ✅ |
| `index.es.js` (Marked/MD) | 158.58 KB | 52.81 KB | ⚠️ Moderate |
| `html2canvas.esm.js` | 201.04 KB | 47.07 KB | ⚠️ Moderate |
| **`index.js` (main bundle)** | **1,493.12 KB** | **400.28 KB** | ❌ Oversized |
| **Total gzip transfer** | — | **~527 KB** | ⚠️ |

**Note:** Vite printed a build warning: *"Some chunks are larger than 500 kB after minification."*

### Main Bundle Contributors (likely)

The 1.49MB main bundle likely contains:
- React + React DOM (~130KB gzip)
- React Router (~25KB gzip)
- All page components loaded eagerly (no lazy loading)
- Recharts or similar chart library (if used)
- Leaflet/mapping libraries (if bundled)

### Recommendations

| Priority | Action | Expected Savings |
|---|---|---|
| **P2** | Add `React.lazy()` + `Suspense` for route-level code splitting — each role's pages only load when needed | ~30–40% bundle reduction |
| **P2** | `html2canvas` (201KB) only needed for export/screenshot features — lazy import it | ~47KB gzip saved |
| **P3** | Audit `index.es.js` (Marked) — if only used in a few pages, lazy import | ~52KB gzip saved |
| **P3** | Enable Vite `build.rollupOptions.output.manualChunks` to split vendor deps | Improved cache hit rate |

**For pilot:** 527KB gzip is acceptable on modern connections (< 2 seconds on 3G, < 0.5s on broadband). Address before general availability.

---

## N+1 Query Analysis

Scanned all route files for patterns that could cause N+1 queries (loop + per-item DB call).

### Method: Code inspection for `forEach`/`.map()` containing `prisma.*` calls

| File | Finding | Assessment |
|---|---|---|
| `routes/opportunities.ts` | `.map()` on IDs only — no per-item Prisma calls | ✅ Clean |
| `routes/sessions.ts` | Sequential Prisma calls within single request handlers, not in loops | ✅ Clean |
| `routes/verification.ts` | Single queries with `include:` for related data | ✅ Clean |
| `routes/schools.ts` | `findMany` with `_count` includes — no per-row queries | ✅ Clean |
| `routes/beneficiaries.ts` | Large route file; pagination applied to directory queries | ✅ Clean |
| `routes/reports.ts` | Aggregation queries; no per-student loops | ✅ Clean |

**No N+1 patterns found.** Prisma's `include:` and `_count:` are used consistently to fetch related data in single queries.

### Potential Future Risk

- `POST /api/notifications` (if ever added): sending per-user notifications in a loop would be an N+1 pattern. Use `createMany()` instead.
- Any new endpoint that iterates over a result set and fetches related records should use `include:` in the initial query.

---

## Database Query Patterns

| Pattern | Usage | Assessment |
|---|---|---|
| Pagination | `skip`/`take` on list endpoints | ✅ Present on most list routes |
| Filtering | `where:` clauses with indexed fields | ✅ Used throughout |
| Eager loading | `include:` for related data | ✅ Avoids N+1 |
| Aggregation | `_count`, `_sum` in selects | ✅ Computed in DB, not app layer |
| Unbounded queries | Any `findMany` without `take` | ⚠️ Spot-check needed (see below) |

### Unbounded Query Check

```
grep -n "findMany" server/src/routes/*.ts | grep -v "take:" | grep -v "limit"
```

Several `findMany` calls lack explicit `take:` limits. For pilot scale (< 100 users) this is acceptable. Before general availability, add `take: 100` or similar guards on any endpoint that returns a potentially large list.

---

## Recommendations Summary

| Priority | Item | Impact |
|---|---|---|
| P2 (post-pilot) | Route-level code splitting with `React.lazy()` | 30–40% bundle reduction |
| P2 (post-pilot) | Lazy import `html2canvas` | 47KB gzip saved |
| P3 (pre-GA) | Audit and add `take:` limits to unbounded `findMany` queries | Prevents accidental full-table scans |
| P3 (pre-GA) | Add database connection pool configuration for production | Prevents connection exhaustion under load |
| P3 (pre-GA) | Load test with k6 or Artillery before GA launch | Validates performance at realistic concurrent user counts |

---

## Monitoring Added

As part of this audit, structured request logging and a correlation ID middleware were added to `server/src/index.ts`:

- Every request now gets an `x-request-id` header (UUID, propagated from client if provided)
- Request logs are structured JSON: `{type, requestId, method, path, status, ms, ip, userId}`
- Log level auto-selects: `info` (2xx), `warn` (4xx), `error` (5xx)
- Global unhandled error handler added: catches any thrown error in route handlers, logs structured JSON, returns appropriate status
- Health endpoint upgraded: `GET /api/health` now runs `SELECT 1` and returns `{"status":"ok","db":"ok"}` or `{"status":"degraded","db":"unreachable"}` (HTTP 503)

---

*Report generated by automated QA audit pipeline on `qa/production-readiness-audit` branch.*
