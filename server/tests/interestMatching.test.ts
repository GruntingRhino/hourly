import test from "node:test";
import assert from "node:assert/strict";
import { rankInterestMatches } from "../src/lib/interestMatching";
test("opt-in interest matching ranks approved tag relevance first", () => {
  const result = rankInterestMatches({ optedIn: true, approvedTags: ["Education", "food"] }, [{ id: "a", tags: ["environment"] }, { id: "b", tags: ["education", "arts"] }, { id: "c", tags: ["food"] }]);
  assert.deepEqual(result.map((item) => item.id), ["b", "c", "a"]);
});
test("opt-out preserves the base marketplace order", () => assert.deepEqual(rankInterestMatches({ optedIn: false, approvedTags: ["education"] }, [{ id: "a", tags: [] }, { id: "b", tags: ["education"] }]).map((item) => item.id), ["a", "b"]));
