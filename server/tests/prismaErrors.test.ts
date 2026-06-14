import assert from "node:assert/strict";
import test from "node:test";

import { isUniqueConstraintError } from "../src/lib/prismaErrors";

test("isUniqueConstraintError detects Prisma P2002 errors", () => {
  assert.equal(isUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(isUniqueConstraintError({ code: "P2025" }), false);
  assert.equal(isUniqueConstraintError(new Error("boom")), false);
});