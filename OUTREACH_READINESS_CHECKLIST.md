# GoodHours Outreach Readiness Checklist

Status key:
- [ ] not done
- [x] done
- [!] needs attention

Use this as the gate before serious outreach, demos, or pilot asks.

## 1) Build and stability
- [ ] Server builds cleanly with no TypeScript errors
- [ ] Client builds cleanly
- [ ] Fresh install works from a clean clone
- [ ] No broken or missing env vars in normal local setup
- [ ] Core flows run without console/runtime errors
- [ ] Any temporary debug code is removed

## 2) Security and dependency hygiene
- [ ] High/critical vulnerabilities are reviewed
- [ ] Safe fixes are applied
- [ ] Breaking upgrades are documented or deferred intentionally
- [ ] Auth/session handling is reviewed for obvious footguns
- [ ] Secrets are not committed
- [ ] `.env.example` is accurate and complete

## 3) Core school workflow reliability
- [ ] Student/service-hour submission flow works end to end
- [ ] Verification flow is clear and enforceable
- [ ] Admin/cohort access works correctly
- [ ] Beneficiary hours are included in reporting where needed
- [ ] At-risk / incomplete submissions are visible
- [ ] Notifications/reminders actually fire

## 4) Monetization readiness
- [ ] Service period / deadline system exists or is clearly scoped
- [ ] Self-submission on/off control exists
- [ ] Category hour caps exist or are clearly scoped
- [ ] Reporting/export supports a real pilot use case
- [ ] Waitlist / promotion flow works if the product uses one
- [ ] Pricing / pilot offer is defined
- [ ] Clear buyer persona is documented

## 5) Outreach assets
- [ ] 1-sentence value prop is written
- [ ] 30-second demo script exists
- [ ] 3-minute product walkthrough exists
- [ ] Simple onboarding flow is documented
- [ ] Pilot email / DM template exists
- [ ] Follow-up sequence exists
- [ ] FAQ / objection handling exists

## 6) Proof and feedback
- [ ] At least one real user or admin has tested the product
- [ ] Feedback is captured in a short list of highest-friction issues
- [ ] There is evidence the product solves a real pain point
- [ ] There is a clear reason schools would switch from their current process
- [ ] The product has one measurable pilot success metric

## 7) Support and operations
- [ ] Bug reporting path exists
- [ ] Basic monitoring / logs exist for production issues
- [ ] Backup / restore story is understood
- [ ] Deployment steps are documented
- [ ] Owner can recover from a failed deploy

## 8) Legal / contracting / safety
- [ ] No promises are made beyond current capabilities
- [ ] Any school/payment/contracts are reviewed with the right adult/legal support
- [ ] Data handling expectations are understood
- [ ] Privacy-sensitive flows are treated carefully

## 9) Outreach gate
Only start serious outreach when all of these are true:
- [ ] Build is green
- [ ] Security is acceptable for pilot use
- [ ] Core workflow is reliable
- [ ] Buyer-facing story is crisp
- [ ] Pilot offer is concrete
- [ ] You can explain the product without hand-waving

## Current known blockers from the latest inspection
- [!] Server TypeScript build is failing
- [!] Dependency vulnerabilities still need review on the Hourly repo
- [!] Monetization/reporting gaps remain in the product docs
- [!] Outreach should be discovery-first, not "finished product" selling

## Decision rule
If any item in sections 1-4 is [!], do discovery outreach only.
If sections 1-5 are green, you can start pilot outreach.
If sections 1-9 are green, you can push for a real pilot commitment.
