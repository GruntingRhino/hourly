# FERPA Rules For GoodHours

Last updated: 2026-04-20

This file defines non-negotiable FERPA rules for this project. These rules are based on official U.S. Department of Education FERPA guidance and must not be broken.

This is a product rule file, not a suggestion list.

## Official Sources

- FERPA overview and rights transfer: https://studentprivacy.ed.gov/faq/what-ferpa
- Eligible student definition: https://studentprivacy.ed.gov/content/eligible-student
- Annual notification requirement: https://studentprivacy.ed.gov/faq/are-educational-agencies-and-institutions-required-notify-parents-and-eligible-students-their
- School official exception and contractor conditions: https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa
- Community-based organization consent rule: https://studentprivacy.ed.gov/faq/prior-written-consent-parent-or-eligible-student-required-disclose-information-community-based
- Community-based organization under school-official exception: https://studentprivacy.ed.gov/faq/when-does-school-official-exception-allow-school-or-lea-non-consensually-disclose-education
- Required consent contents: https://studentprivacy.ed.gov/faq/what-must-consent-disclose-education-records-contain
- Disclosure recordkeeping: https://studentprivacy.ed.gov/faq/are-schools-required-record-disclosure-personally-identifiable-information-pii-students
- Directory information rule: https://studentprivacy.ed.gov/faq/may-educational-agency-or-institution-disclose-directory-information-without-prior-consent

## Core Principle

GoodHours handles K-12 student data. Treat student names, emails, grades, cohort membership, hours, attendance, verification state, disciplinary-like no-show history, and parent-link access as education-record data or personally identifiable information derived from education records unless counsel for a specific school has documented otherwise.

If there is any doubt, default to "protected under FERPA."

## Always Rules

### 1. Default deny

- No user may access student education-record data unless the project can point to a valid FERPA basis for that exact disclosure.
- "The user is related to the workflow" is not enough.
- "The school approved the partner" is not enough by itself.

### 2. School staff access must be least-privilege

- Access to student records inside a school must be limited to school officials with a legitimate educational interest.
- The application must not grant blanket access just because a user is an employee.
- Every new staff-facing surface must answer: why does this role need this record to perform a professional responsibility?

### 3. Third parties do not get student PII by default

- Community partners, nonprofits, vendors, contractors, volunteers, and outside organizations must be treated as third parties unless the school has explicitly designated them as school officials under FERPA and the required conditions are satisfied.
- A school-partner relationship alone does not create FERPA permission to disclose student PII.
- Before any third party sees student names, emails, grades, hours, status, or history, one of these must be true:
  - the school has written consent from the parent or eligible student covering that disclosure, or
  - the third party qualifies under the school-official exception and is under direct control for use and maintenance of the records, is barred from redisclosure except as allowed, and fits the school's annual FERPA notice criteria.

### 4. Consent must be explicit and auditable

- If disclosure relies on consent, the system must store a signed-and-dated consent record.
- Consent must specify:
  - which records may be disclosed
  - the purpose of the disclosure
  - the party or class of parties receiving the disclosure
- Oral consent, implied consent, or "student clicked a share button" is not sufficient for K-12 parent-rights scenarios unless the student is an eligible student.

### 5. Parent rights control until the student is an eligible student

- For K-12, FERPA rights belong to the parent until the student turns 18 or attends a postsecondary institution.
- Product flows must not assume a minor student can authorize public or bearer-token disclosure of education records to a parent or anyone else.
- Parent-sharing features must handle the distinction between:
  - parent-controlled access for non-eligible students
  - student-controlled access for eligible students

### 6. No directory-information shortcuts without school policy and opt-out support

- The project must not treat names, emails, grade levels, participation, or school affiliation as freely shareable "directory information" unless the school has:
  - designated that exact data category as directory information
  - issued annual notice
  - provided an opt-out right
  - tracked and enforced opt-out status
- If the application does not implement that full workflow, then do not rely on directory-information disclosure.

### 7. Non-consensual third-party disclosures must be logged per student

- If the project discloses protected student PII to a non-school party without consent under a FERPA exception, it must maintain a disclosure record with the student's records unless the disclosure falls into a FERPA recordkeeping exception.
- The log must identify:
  - the receiving party
  - what was disclosed
  - when it was disclosed
  - the legitimate interest or legal basis
- School-internal access logs are useful but do not replace FERPA disclosure records for third-party disclosures.

### 8. Redisclosure must be contractually and technically constrained

- Any third party receiving FERPA-protected data under the school-official exception must be restricted to the disclosed purpose.
- The project must not expose student PII to a third party that can freely reuse or redisclose it.
- Product design must assume redisclosure is prohibited unless explicitly permitted by FERPA and school policy.

### 9. Data minimization is mandatory

- Every screen, API payload, export, email, and notification must disclose the minimum student data needed.
- If an operation can be completed with pseudonymous IDs, status buckets, counts, or masked fields, do not send names and emails.
- Do not include student PII in logs, analytics, support tooling, or error payloads unless operationally necessary and access-controlled.

### 10. Access, amendment, and correction rights must be preservable

- The project must support school workflows for inspection and review of records by the parent or eligible student.
- The project must preserve enough provenance and edit history for schools to respond to amendment requests.
- Do not build irreversible transformations that make it impossible to reconstruct what record existed and who changed it.

### 11. Deletion cannot destroy required auditability

- "Delete" flows must not silently destroy records a school may need to meet FERPA rights, disclosure logging, or legal retention duties.
- If records are anonymized, audit links and disclosure history must remain coherent.

### 12. Public links are treated as disclosures

- Any bearer token, share URL, emailed report link, or downloadable export that exposes student progress is a disclosure channel.
- These links must be:
  - purpose-bound
  - time-limited
  - revocable
  - minimally scoped
- Public link generation must honor whether the requester is actually authorized to disclose the data.

### 13. Messaging with third parties must not leak protected student data by accident

- Direct messages, notifications, and announcements involving outside organizations must not expose student records unless a FERPA basis exists.
- A beneficiary being able to message a school or student does not automatically allow the app to include student academic or hours data in that thread.

### 14. "FERPA-compliant" claims require evidence

- The project must not claim FERPA compliance in UI, marketing, or sales material unless the implemented controls and school operating requirements actually support that claim.
- If a control depends on school policy, annual notice, consent collection, or contract language outside the codebase, the claim must say so.

## Current Project Assessment

This section is based on the current codebase only. It is not a legal opinion. It is an engineering risk assessment against the rules above.

### Areas that are directionally good

- Server-side role checks and school scoping exist on most school data routes.
- `DataAccessLog` records many school-side accesses and exports.
- Parent progress tokens are signed and time-limited.
- Student deletion is anonymization-oriented rather than hard-delete-first.
- There is clear separation between school staff, students, and beneficiaries in many route guards.

### Current compliance risks that must be treated as open issues

#### 1. Beneficiary admins can see student names and emails without a documented FERPA basis

Current code:

- [server/src/routes/beneficiaries.ts](/Users/abhay/Hourly/server/src/routes/beneficiaries.ts:1040) returns signup rosters to beneficiary admins and attaches each student's `id`, `name`, and `email`.
- [server/src/routes/beneficiaries.ts](/Users/abhay/Hourly/server/src/routes/beneficiaries.ts:1303) returns signup history including student identity and attendance/verification details.

Risk:

- Under Department guidance, community-based organizations generally need consent unless they qualify under the school-official exception.
- The codebase does not currently implement a school-specific FERPA designation workflow, direct-control contract tracking, or annual-notice criteria enforcement for beneficiary admins.

Required project rule:

- Do not expose student PII to beneficiary admins unless the school has either recorded valid consent or explicitly designated that beneficiary workflow under a valid school-official exception model with enforceable redisclosure restrictions.

#### 2. Parent-link generation is risky for non-eligible students

Current code:

- [server/src/routes/reports.ts](/Users/abhay/Hourly/server/src/routes/reports.ts:373) lets any authenticated student generate a 30-day bearer token for parent progress.

Risk:

- In K-12, FERPA rights usually belong to parents until the student becomes an eligible student.
- A minor student should not be treated as the consent authority for public-link disclosure of education-record data.

Required project rule:

- Parent-link generation for non-eligible students must be parent- or school-controlled, or backed by a documented consent/authorization workflow. Student-self-serve sharing is only safe for eligible students.

#### 3. Third-party disclosure logging is incomplete

Current code:

- `DataAccessLog` is focused on school-side access.
- There is no per-student FERPA disclosure record for beneficiary-facing disclosure of student PII.

Risk:

- FERPA generally requires disclosure records for non-consensual disclosures unless an exception to recordkeeping applies.
- If beneficiary access is not truly under the school-official exception, the current logging model is insufficient.

Required project rule:

- Add disclosure logging for every student record disclosed to a non-school party, with party and legal basis.

#### 4. No implemented annual-notice or directory-information workflow

Current code:

- No school-facing configuration for annual FERPA notice criteria.
- No directory-information designation UI.
- No parent/eligible-student opt-out tracking.

Risk:

- The project cannot safely rely on directory-information disclosure or school-official exception criteria being implemented inside the product.

Required project rule:

- Until those controls exist, do not rely on directory-information theory or implied school-official designation in application logic.

#### 5. "FERPA-compliant" marketing language is stronger than the controls shown in code

Current code:

- The landing page includes FERPA-compliance-style claims.

Risk:

- The codebase shows partial controls, not a complete FERPA operating model.

Required project rule:

- Replace absolute claims with qualified language unless the missing policy, consent, and contractor-control layers are actually in place.

## Hard Engineering Decisions From These Rules

Until the open issues above are fixed, GoodHours must follow these implementation constraints:

- Do not add new third-party student-data surfaces for beneficiaries.
- Do not expand beneficiary roster fields beyond the absolute minimum.
- Do not add any new public or bearer-token sharing flows for student data.
- Do not expose student email addresses to outside organizations unless a FERPA basis is explicitly captured.
- Do not claim FERPA compliance as a blanket product property.

## Minimum Changes Required To Reduce Current FERPA Risk

- Add a school-level FERPA configuration layer:
  - annual notice acknowledgement
  - contractor/school-official designation criteria
  - directory-information categories
  - directory-information opt-out tracking
- Add consent records:
  - parent consent for minors
  - eligible-student consent for eligible students
  - disclosure purpose and recipient scope
- Add disclosure logs for non-school-party disclosures.
- Gate beneficiary roster access on a real FERPA basis:
  - consent-based, or
  - school-official/contractor mode with documented direct control and redisclosure restrictions
- Rework parent links:
  - school-issued or parent-authorized for minors
  - revocation support
  - shorter expiry and issuance log
- Review and soften FERPA-compliance marketing claims until the controls exist.

## Release Gate

Any future change that violates these rules must be blocked from release until counsel-approved remediation exists.
