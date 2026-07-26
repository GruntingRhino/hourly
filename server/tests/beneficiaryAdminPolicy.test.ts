import test from "node:test";
import assert from "node:assert/strict";
import { canRemoveBeneficiaryAdmin } from "../src/lib/beneficiaryAdminPolicy";

test("prevents removing the final organization owner", () => {
  assert.equal(canRemoveBeneficiaryAdmin({ targetRole: "OWNER", ownerCount: 1, targetUserId: "owner", actorUserId: "owner" }), false);
});

test("allows an owner to remove a non-owner administrator", () => {
  assert.equal(canRemoveBeneficiaryAdmin({ targetRole: "ADMIN", ownerCount: 1, targetUserId: "admin", actorUserId: "owner" }), true);
});

test("allows removing one of multiple organization owners", () => {
  assert.equal(canRemoveBeneficiaryAdmin({ targetRole: "OWNER", ownerCount: 2, targetUserId: "owner-a", actorUserId: "owner-b" }), true);
});
