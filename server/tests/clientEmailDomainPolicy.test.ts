import test from "node:test";
import assert from "node:assert/strict";

import { classifyEmailDomain } from "../../client/src/lib/emailDomainPolicy";

test("personal provider emails are accepted only when the temporary bypass is enabled", () => {
  assert.equal(classifyEmailDomain("admin@gmail.com", true, false), "personal");
  assert.equal(classifyEmailDomain("admin@gmail.com", true, true), "custom");
  assert.equal(classifyEmailDomain("admin@example.org", true, false), "custom");
  assert.equal(classifyEmailDomain("admin@college.edu", true, false), "edu");
});
