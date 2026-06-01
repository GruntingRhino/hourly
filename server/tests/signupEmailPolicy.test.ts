import test from "node:test";
import assert from "node:assert/strict";

import {
  emailDomainMatchesWebsite,
  extractDomainFromWebsite,
  isPersonalEmailDomain,
  isQaSignupBypassEmail,
  normalizeEmail,
} from "../src/lib/signupEmailPolicy";

test("normalizeEmail trims and lowercases input", () => {
  assert.equal(normalizeEmail("  Admin@Example.ORG  "), "admin@example.org");
});

test("personal email domains remain blocked by default", () => {
  assert.equal(isPersonalEmailDomain("teacher@gmail.com"), true);
  assert.equal(isPersonalEmailDomain("principal@district.k12.ca.us"), false);
});

test("QA signup aliases require explicit opt-in", () => {
  assert.equal(isQaSignupBypassEmail("abhay.sivaram+pilot@gmail.com", false), false);
  assert.equal(isQaSignupBypassEmail("abhay.sivaram+pilot@gmail.com", true), true);
  assert.equal(isQaSignupBypassEmail("random.user@gmail.com", true), false);
});

test("website domain parsing and matching stay strict but practical", () => {
  assert.equal(extractDomainFromWebsite("https://www.example.edu/signup?x=1"), "example.edu");
  assert.equal(extractDomainFromWebsite("district.k12.ca.us/path"), "district.k12.ca.us");
  assert.equal(extractDomainFromWebsite("not a url"), null);

  assert.equal(emailDomainMatchesWebsite("staff.example.edu", "example.edu"), true);
  assert.equal(emailDomainMatchesWebsite("example.edu", "example.edu"), true);
  assert.equal(emailDomainMatchesWebsite("example.com", "example.edu"), false);
});
