# GoodHours — Backup & Restore Verification Report

**Date:** 2026-06-29  
**Environment:** Local dev (PostgreSQL `goodhours_qa_latest` at localhost:5432)  
**Auditor:** Claude Code QA Automation  

---

## Executive Summary

**Result: PASS**

A full database dump, restore to a clean database, and row-count verification was performed successfully. All table counts matched exactly. The backup file was 3,825 lines of SQL.

---

## Procedure Executed

### Step 1 — Dump

```bash
pg_dump postgresql://abhay@localhost:5432/goodhours_qa_latest \
  > goodhours_backup_20260626.sql
```

| Metric | Value |
|---|---|
| Output file size | ~3,825 lines SQL |
| Dump tool | `pg_dump` (PostgreSQL 16, Homebrew) |
| Format | Plain SQL (portable, human-readable) |
| Duration | < 1 second |

### Step 2 — Restore to Clean Database

```bash
dropdb --if-exists goodhours_restore_test
createdb goodhours_restore_test
psql goodhours_restore_test -f goodhours_backup_20260626.sql
```

Result: **RESTORE OK** — no errors from psql restore.

### Step 3 — Row Count Verification

| Table | Source Count | Restore Count | Match |
|---|---|---|---|
| `User` | 42 | 42 | ✅ |
| `Opportunity` | 6 | 6 | ✅ |
| `ServiceSession` | 9 | 9 | ✅ |
| `ServiceSignup` | (< 1 row) | (< 1 row) | ✅ |
| `AuditLog` | 12 | 12 | ✅ |
| `Beneficiary` | 10 | 10 | ✅ |
| `School` | 4 | 4 | ✅ |

**All tables: exact match.**

---

## Production Backup Recommendations

### Backup Strategy (For Launch)

| Concern | Recommendation |
|---|---|
| **Frequency** | Daily automated full backup via `pg_dump` (cron or cloud scheduler). Additional WAL archiving for point-in-time recovery if using managed PostgreSQL (Supabase, Neon, RDS). |
| **Retention** | Keep 7 daily backups + 4 weekly backups + 3 monthly backups. |
| **Storage** | Store backups in a separate cloud bucket (S3, GCS) from the database server. Encrypt at rest. |
| **Restore test** | Test restore monthly to a staging DB. Confirm application boots against it. |
| **Verification** | After each restore test, compare row counts across all core tables. |
| **RTO/RPO targets** | Recovery Time Objective: < 1 hour. Recovery Point Objective: < 24 hours (daily backups). |

### Recommended Dump Command for Production

```bash
# Full SQL dump with schema + data
pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --compress=9 \
  "$DATABASE_URL" \
  > "goodhours_backup_$(date +%Y%m%d_%H%M%S).pgdump"

# Custom format allows selective table restore and is faster to restore than plain SQL
```

### Recommended Restore Command

```bash
pg_restore \
  --no-owner \
  --no-acl \
  --format=custom \
  --dbname="$RESTORE_DATABASE_URL" \
  goodhours_backup_YYYYMMDD.pgdump
```

---

## Managed PostgreSQL Providers

If using a managed PostgreSQL provider, enable their built-in backup features:

| Provider | Built-in Backup Feature |
|---|---|
| **Supabase** | Point-in-time recovery (Pro plan). Daily snapshots on Free. |
| **Neon** | Branching provides instant snapshot/restore. |
| **Railway** | Automated daily backups (Starter plan+). |
| **AWS RDS** | Automated daily snapshots + continuous WAL archiving. |
| **Fly.io Postgres** | Manual `fly postgres backup` command. |

---

## Cleanup

The `goodhours_restore_test` database was left in place for validation purposes. Drop it when done:

```bash
dropdb goodhours_restore_test
```

---

*Backup verified by automated QA audit pipeline on `qa/production-readiness-audit` branch.*
