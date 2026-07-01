import test from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_OPPORTUNITY_CATEGORY,
  OPPORTUNITY_CATEGORY_OPTIONS,
  isPredefinedOpportunityCategory,
  resolveOpportunityCategory,
} from "../src/lib/opportunityCategories";

test("opportunity categories are alphabetized", () => {
  const sorted = [...OPPORTUNITY_CATEGORY_OPTIONS].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(OPPORTUNITY_CATEGORY_OPTIONS, sorted);
});

test("predefined categories are recognized after sorting", () => {
  assert.equal(isPredefinedOpportunityCategory("Animal Welfare"), true);
  assert.equal(isPredefinedOpportunityCategory("Science & Research"), true);
  assert.equal(isPredefinedOpportunityCategory("Not A Real Category"), false);
});

test("custom category resolution still prefers the explicit custom value", () => {
  assert.equal(resolveOpportunityCategory(CUSTOM_OPPORTUNITY_CATEGORY, "Mutual Aid"), "Mutual Aid");
  assert.equal(resolveOpportunityCategory("Mutual Aid", ""), "Mutual Aid");
  assert.equal(resolveOpportunityCategory("  Education  ", ""), "Education");
});
