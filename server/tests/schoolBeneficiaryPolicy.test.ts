import test from "node:test";
import assert from "node:assert/strict";
import { SCHOOL_CREATED_BENEFICIARY_PLAN } from "../src/lib/schoolBeneficiaryPolicy";

test("every school-created beneficiary starts on the centralized FREE plan", () => {
  assert.deepEqual(SCHOOL_CREATED_BENEFICIARY_PLAN, { planTier: "FREE" });
});
