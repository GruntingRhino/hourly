import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveBeneficiaryPlanTier,
  schoolCreatedBeneficiaryPlan,
} from "../src/lib/schoolBeneficiaryPolicy";

test("a private beneficiary automatically created for a school receives permanent Pro", () => {
  assert.deepEqual(schoolCreatedBeneficiaryPlan("PRIVATE"), {
    planTier: "PRO",
    hasSchoolComplimentaryPro: true,
  });
  assert.equal(resolveBeneficiaryPlanTier({ createdBySchoolId: "school-1", visibility: "PRIVATE" }, "FREE"), "PRO");
});

test("a public school-created beneficiary does not receive complimentary Pro", () => {
  assert.deepEqual(schoolCreatedBeneficiaryPlan("PUBLIC"), { planTier: "FREE" });
});

test("an ordinary private organization remains Free unless it has a paid Pro entitlement", () => {
  const ordinary = { createdBySchoolId: null, visibility: "PRIVATE" as const };
  assert.equal(resolveBeneficiaryPlanTier(ordinary, "FREE"), "FREE");
  assert.equal(resolveBeneficiaryPlanTier(ordinary, "PRO"), "PRO");
});

test("complimentary school Pro remains permanent after a later visibility change", () => {
  assert.equal(resolveBeneficiaryPlanTier({
    createdBySchoolId: "school-1",
    visibility: "PUBLIC",
    hasSchoolComplimentaryPro: true,
  }, "FREE"), "PRO");
});
