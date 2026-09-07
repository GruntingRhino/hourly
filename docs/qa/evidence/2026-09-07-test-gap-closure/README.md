# Test-gap closure evidence — 2026-09-07

Closes the two gaps that were previously diagnosed but left open. Both were confirmed to be
real before being fixed, and both fixes were confirmed by negative control, not just by a
green run.

## Gap 1 — the opportunity-detail axe scan passed without scanning

The prior run is preserved at
`../2026-09-07-canvas-integration/prior-a11y-vacuous-opportunity-scan.txt`:

```
[Opportunity Detail] No opportunity links found on browse page — skipping navigation
  ✓   9 tests/accessibility.spec.ts:290:5 › Opportunity detail page — WCAG 2.1 AA (1.7s)
```

Three separate causes, all fixed in `tests/accessibility.spec.ts`:

1. The test `return`ed when no opportunity link was found, so it passed having scanned nothing.
2. Its locator, `'a[href*="/opportunity/"], button'`, could resolve `.first()` to a `<button>`
   whose `href` is null, pushing it onto that skip path even when a link existed.
3. There was a genuine fixture gap underneath — the QA database held **zero** opportunities, and
   `client/src/pages/student/Browse.tsx:409` links to `/opportunity/<id>` only when a slot
   carries `legacyOpportunityId`, otherwise to `/slot/<id>`.

The test is now pinned to an explicit synthetic `Opportunity` created in the disposable QA
database, asserts the URL and that the fixture actually rendered, and has no skip path.
`runAxe()` additionally asserts that axe evaluated at least one rule.

`accessibility-12-passed.txt` — 12 passed. Test 9 now reports `rulesEvaluated:17`, i.e. the page
was really scanned:

```
[Opportunity Detail] Summary — critical:0 serious:0 moderate:0 minor:0 rulesEvaluated:17
  ✓   9 tests/accessibility.spec.ts:316:5 › Opportunity detail page — WCAG 2.1 AA (2.5s)
```

**Negative control.** A throwaway spec reproducing the historical condition — the detail page not
reachable, using an id that does not exist — was run against the same stack and **failed**, as it
must:

```
Error: detail page did not render the fixture
expect(locator).toBeVisible() failed
Error: element(s) not found
  1 failed
```

Scope note, so the `rulesEvaluated` guard is not overstated: it catches an axe run that evaluated
no rules at all. It does **not** catch "the page rendered, but it was the wrong page" — an empty
document still evaluates rules, which was verified directly. Landing on the intended page has to
be asserted per test, which is what the navigation assertions in test 9 now do.

## Gap 2 — the accepted procurement upload was never exercised

`UP-08` deliberately stopped at `400 no active procurement record`, because no route in the repo
creates a `SchoolBillingRecord`. The accepted path — the 201, what is persisted, and who may read
it back — was therefore untested. Five tests were added to `tests/security/10-uploads.spec.ts`,
with the billing record supplied as an explicit synthetic fixture:

| Test | What it proves |
|---|---|
| UP-09 | A genuine PDF from the school's own admin is **accepted**, 201, with the document id echoed. |
| UP-10 | The stored row carries the right `schoolId` and `uploadedByUserId`, the **verified** MIME type (`application/pdf`, not the client-declared one), and byte counts equal to the upload. |
| UP-11 | The school's own admin reads it back **byte for byte**, with `Content-Type` and a `Content-Disposition` naming the original file. |
| UP-12 | Nobody else can read it: the other school's admin → 403 (and no `%PDF` in the body), a student → 403, anonymous → 401. |
| UP-13 | There is **no delete endpoint**, asserted rather than merely asserted in prose, and the document survives the attempt. |

**Correction to the task wording.** The checklist asked for "authorized read/**delete**". A delete
cannot be proved because the surface does not exist: `server/src/routes/schoolProcurement.ts`
exposes only `GET /:id/summary`, `POST /:id/quote-request`, `POST /:id/documents` and
`GET /:id/documents/:docId`, and `client/src/pages/school/SchoolBilling.tsx` calls only upload and
download. UP-13 records that as a test so the claim cannot silently rot; if a delete route is ever
added, UP-13 fails and must be replaced with real lifecycle coverage.

`security-165-passed.txt` — 165 passed, 0 failed, 0 skipped (was 160; +5).

## Fixture safety

`tests/helpers/qaFixtures.ts` reuses `validatedQaUrl()` from
`tests/security/helpers/qaDb.ts` rather than copying it, so the loopback-only and
`_qa`/`_test`-suffix guards cannot drift apart from the read-side checks. It additionally proves
by positive control that it is writing to the same database the API under test is serving — a
fixture landing in a second, separately seeded database would otherwise look like a product bug.
Every fixture is removed afterwards; the QA database was verified back at
`organizations: 0  opportunities: 0  billingRecords: 0  procurementDocs: 0` after the runs.

No production data is reachable from these fixtures, and no billing data outside the disposable
`goodhours_qa` database was created or touched.

## A note on limiter contamination

An intermediate run of the security suite reported 150 passed with 15 failures across
`04-messaging-safety`, `07-input-validation` and `09-signin`. That was throttling from running the
same suite twice in a row against one long-lived API, not a regression: the identical suite had
just returned 165/165, and re-running it against a **freshly started** API returned 165/165 again.
The authoritative log here is the fresh-API run.

## Gates

- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `git diff --check` → clean
- Tests changed only. No application source was modified, so no deployment is required.
