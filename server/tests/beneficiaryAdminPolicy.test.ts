import test from "node:test";
import assert from "node:assert/strict";
import { canRemoveBeneficiaryAdmin, roleForBeneficiaryClaim } from "../src/lib/beneficiaryAdminPolicy";

test("the first administrator claiming an organization becomes its owner", () => {
  assert.equal(roleForBeneficiaryClaim(false), "OWNER");
});

test("a later administrator joining an owned organization is not elevated", () => {
  assert.equal(roleForBeneficiaryClaim(true), "ADMIN");
});

test("prevents removing the final organization owner", () => {
  assert.equal(canRemoveBeneficiaryAdmin({ targetRole: "OWNER", ownerCount: 1, targetUserId: "owner", actorUserId: "owner" }), false);
});

test("allows an owner to remove a non-owner administrator", () => {
  assert.equal(canRemoveBeneficiaryAdmin({ targetRole: "ADMIN", ownerCount: 1, targetUserId: "admin", actorUserId: "owner" }), true);
});

test("allows removing one of multiple organization owners", () => {
  assert.equal(canRemoveBeneficiaryAdmin({ targetRole: "OWNER", ownerCount: 2, targetUserId: "owner-a", actorUserId: "owner-b" }), true);
});
