# Student Privacy Compliance Notes

Date: 2026-05-10

## Scope

This document records the technical privacy and safety hardening completed in the GoodHours development environment during the LMS membership migration and Canvas foundation work.

It is not a legal certification. FERPA and COPPA compliance also depend on contracts, school governance, notices, retention policies, support processes, and district-specific operational controls.

## What Was Hardened

### 1. School-controlled access boundaries

- Staff access checks now use active `StudentCohortMembership` records in addition to legacy primary `cohortId`.
- School-facing student reads were migrated across:
  - reports
  - exports
  - at-risk lists
  - reminders
  - launch-center summaries
  - verification queues
  - self-submissions
  - school student directories
  - cohort detail views
  - messaging recipient selection
- Session and report authorization paths now resolve school membership through classroom, primary cohort, or active cohort memberships instead of assuming one direct cohort binding.

Privacy impact:

- reduces cross-school and cross-cohort data leakage risk
- aligns access closer to legitimate school control over the enrolled student population

### 2. Parent/guardian progress sharing is no longer self-service

- `POST /api/reports/parent-link` is disabled
- `GET /api/reports/parent-progress` is disabled
- the parent progress UI now explains that sharing must happen through a school-controlled workflow
- tests were updated to enforce the disabled state

Privacy impact:

- removes a student-self-issued public sharing path
- avoids bypassing school-controlled FERPA/COPPA review and consent processes

### 3. Auditability and disclosure traceability

- existing `DataAccessLog` coverage remains in place for school reports, student lists, and integration actions
- integration sync jobs and sync errors remain persisted
- school-admin-only LMS connection and sync actions remain auditable

Privacy impact:

- supports disclosure review, incident response, and school oversight

### 4. Data minimization in public or third-party-facing contexts

- organization reports continue to use anonymized volunteer labels instead of direct student identity
- beneficiary admins remain blocked from directly messaging students
- direct student-to-student messaging remains blocked

Privacy impact:

- reduces unnecessary exposure of student PII
- preserves school-mediated communication boundaries with minors

### 5. Development credential handling

- Canvas tokens remain encrypted at rest when `FIELD_ENCRYPTION_KEY` is set
- no production secrets were introduced
- Canvas remains optional and school-admin-only

Privacy impact:

- limits credential disclosure risk in development and future pilot rollout

## Why These Changes Matter Under FERPA/COPPA

These implementation choices are consistent with official guidance, including:

- FERPA limits non-consensual access to school officials with legitimate educational interests and requires the school to stay in control of education-record use and maintenance.
- FERPA emphasizes disclosure recordkeeping in many circumstances outside the school-official exception.
- COPPA allows a school to act in the consent chain only when the operator is collecting student information for the use and benefit of the school and not for another commercial purpose.
- COPPA school-based consent still requires clear notice to the school about collection, use, and disclosure practices.

## Remaining Requirements Before Any Production Claim

### Contract and governance requirements

- school or district DPA / vendor agreement
- explicit designation of GoodHours as a school official or equivalent district-approved processor where needed
- documented direct-control terms for use and maintenance of student records
- district-approved data retention and deletion schedule

### COPPA-specific operational requirements

- documented school-authorized consent path for students under 13 where applicable
- direct notice package for school administrators covering data collected, use, disclosure, review, and deletion rights
- confirmation that student data is used only for the school service purpose and not unrelated commercial profiling

### Product requirements still outstanding

- repo-wide completion of the migration away from legacy primary-`cohortId` assumptions
- real Canvas sandbox or district-tenant validation
- formal privacy review of every field collected from students, especially optional profile fields
- stronger audit-log durability guarantees if required by district policy
- explicit admin workflow for parent/guardian progress sharing instead of self-service links

## Recommended Next Technical Steps

1. Finish the repo-wide audit of remaining `cohortId`-only paths.
2. Add a school-admin-controlled parent/guardian access workflow with explicit consent metadata, expiry, and disclosure logging.
3. Review student profile fields for minimization; remove or further restrict any field not needed for the school service.
4. Validate the live Canvas flow against a real sandbox tenant before any pilot that touches actual student data.
5. Add an operator-facing privacy checklist to school onboarding and LMS setup.

## Reference Sources

- U.S. Department of Education, Protecting Student Privacy:
  - https://studentprivacy.ed.gov/faq/under-ferpa-may-educational-agency-or-institution-disclose-education-records-any-its-employees
  - https://studentprivacy.ed.gov/faq/are-schools-required-record-disclosure-personally-identifiable-information-pii-students
  - https://studentprivacy.ed.gov/index.php/frequently-asked-questions
- Federal Trade Commission, COPPA FAQ:
  - https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
