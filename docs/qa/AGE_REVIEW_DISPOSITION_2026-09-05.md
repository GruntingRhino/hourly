# Age/session independent-review disposition — 2026-09-05

This note records dispositions for the independent review at `/tmp/goodhours-age-independent-review/REPORT.md`. It is an engineering disposition, not a compliance or security-clearance conclusion.

## GH-AGE-01 — rejected recommendation; intentional personal deletion preserved

The review recommended restoring `deleteSchoolData` to personal account deletion. That recommendation is rejected by product design: deleting a user's personal account must not delete the school or other users' records. The existing last-school-admin protection and personal-data deletion behavior remain intentional. No school-wide cleanup call was restored.

## GH-AGE-04 — rejected recommendation; owner approval design preserved

The review recommended requiring `ownershipEvidenceVerifiedAt` before token-owner approval. That is rejected by the intentional authorization design: possession of the independently delivered owner-approval token is the separate owner authorization evidence and may approve without the registrant's contact-evidence timestamp. The token remains hashed, single-use, and non-expiring by design; GET renders without mutation and POST performs the decision. No contact gate was added.

The stale GET copy claiming approval remains blocked until `ownershipEvidenceVerifiedAt` is present should be corrected separately so it accurately describes the independent owner authorization step.

## GH-AGE-02 — fixed

Returning Google identities now load the persisted eligibility attestation relation and expose only the boolean `requiresEligibilityAttestation` in the user payload. Provider exchange and real Google callback execution remain external/unexecuted boundaries.

## GH-AGE-03 — fixed

Beneficiary and additional-beneficiary-admin onboarding now render an unchecked-by-default 13+ checkbox, submit its actual state, and keep the server-side `z.literal(true)` validation. The account-creation button is disabled until checked.

## GH-AGE-05 — fixed

Student invitation acceptance now claims the pending, unexpired invitation conditionally inside a serializable transaction and performs user, attestation, membership, and starting-hour creation in that transaction. Imported starting hours carry a unique invitation lineage key, preventing duplicate credit rows. Losing concurrent requests return 409; rollback is preserved on failure.

## GH-AGE-06 — fixed

Beneficiary decline now hashes the submitted token before querying the hashed database column. Already-declined invitations remain idempotent.

## Verification boundary

The disposable PostgreSQL migration and TypeScript/client builds were run after these changes. The final canonical suite must be rerun after the last source/documentation edit; no production, provider, email-delivery, or legal-review claims are made here.
