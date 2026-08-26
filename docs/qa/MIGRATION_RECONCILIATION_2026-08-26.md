# Migration reconciliation — 2026-08-26

Question raised by launch readiness review: `prisma migrate diff` showed a large
destructive diff (7 DROP TABLE + 2 DROP COLUMN) between the disposable test
database and the current Prisma schema. Was this a stale test DB or a real gap in
the migrations history?

## Verdict

**The test DB was NOT stale. The committed schema datamodel (`schema.prisma`)
was missing declarations for objects its own committed migrations create.**

- Replaying the full migrations directory into a fresh shadow database produces
  DDL **byte-identical** to the live disposable test DB
  (`diff` of the two `prisma migrate diff --script` outputs: no differences).
- Therefore migrations history is coherent and every environment built from it
  (local test DB, staging) contains the same tables. Only `schema.prisma`
  disagreed with reality.
- Root cause: the merge reconciliation at `daebece` restored a subset of models
  from the pre-merge schema line but dropped 7 models (+2 columns on
  `OrgEventReminderLog`) that committed migrations create:

| Object | Creating migration |
| --- | --- |
| `AttendanceQrToken` | `20260808213000_add_attendance_qr_tokens` |
| `AttendanceQrRedemption` | `20260808213000_add_attendance_qr_tokens` |
| `SupervisorVerification` | `20260809094000_add_supervisor_verification` |
| `SignupQuestionTemplate` | `20260809093000_add_signup_question_templates` |
| `BeneficiaryImportBatch` | `20260809095000_add_import_batches` |
| `OrganizationReliabilityEvent` | `20260809092000_add_reliability_events` |
| `BeneficiarySignupAnswer` | `20260809093000_add_signup_question_templates` |
| `OrgEventReminderLog.attempts`, `.leasedUntil`, index `(leasedUntil, deliveryStatus)` | `20260629212500_serverless_durability_and_scheduler` |

## Evidence commands

```bash
# 1. Ledger says all applied (this alone proves nothing about DDL)
npx prisma migrate status
# -> 63 migrations found in prisma/migrations
#    Database schema is up to date!

# 2. Live disposable test DB vs current (pre-fix) schema: destructive ops
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script
# -> 21 DROP statements (7 tables, 2 columns, FK/index drops)

# 3. Fresh shadow DB built purely from the migrations dir vs the same schema
podman exec goodhours-test-pg psql -U goodhours_test -d goodhours_test \
  -c "CREATE DATABASE goodhours_shadow OWNER goodhours_test"
npx prisma migrate diff --from-migrations prisma/migrations \
  --shadow-database-url 'postgresql://.../goodhours_shadow?schema=public' \
  --to-schema-datamodel prisma/schema.prisma --script
# -> identical destructive script; `diff` vs step 2 output: empty

# Conclusion: live test DB DDL == migrations-replayed shadow DDL,
# so the drift was schema.prisma, not the test DB.
```

## Resolution (non-destructive)

Restored the missing model declarations, back-relations
(`User`, `School`, `Beneficiary`, `BeneficiarySignup`, `Opportunity`,
`ServiceSession`) and the two `OrgEventReminderLog` durability columns/index
into `schema.prisma` from ancestor `12d31fa` (the last schema that contained
them), keeping all newer worktree improvements (enum conversions, tenant
indexes, `SchoolRegistrationIntent`, `ServiceHourLedgerEntry`). No new
migration was created; no DROP statement exists anywhere in this change.

Post-fix verification:

```bash
npx prisma format && npx prisma validate   # PASS
npx prisma generate                        # PASS
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script
# -> "-- This is an empty migration."
npx prisma migrate diff --from-migrations prisma/migrations \
  --shadow-database-url '...goodhours_shadow...' \
  --to-schema-datamodel prisma/schema.prisma --script
# -> "-- This is an empty migration."
```

Both directions are now drift-free: schema ↔ migrations ↔ databases agree
exactly. No destructive migration was created against any environment, and none
is needed.

## Notes

- Current server source references none of the restored delegates directly;
  the QR/supervisor-verification flows intentionally use signed-token
  primitives (see updated architecture tests). The tables remain declared
  because committed migrations create them in staging/prod — leaving them
  undeclared is what made `migrate dev` propose destructive drops.
- Future cleanup (if these features stay unwired after launch): write an
  explicit, reviewed forward migration dropping unused tables with backup taken
  first. Do NOT let `prisma migrate dev` auto-generate it against a shared DB.
