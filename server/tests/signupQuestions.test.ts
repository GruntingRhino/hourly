import test from "node:test";
import assert from "node:assert/strict";
import { validateSignupAnswers, validateSignupTemplate } from "../src/lib/signupQuestions";
const template = validateSignupTemplate([{ id: "shirt", label: "Shirt size", type: "TEXT", required: true }]);
test("typed signup questions enforce required, scoped answers and privacy limits", () => { assert.deepEqual(validateSignupAnswers(template, { shirt: "M", extra: "ignored" }), { shirt: "M" }); assert.throws(() => validateSignupAnswers(template, {})); assert.throws(() => validateSignupAnswers(template, { shirt: "x".repeat(501) })); });
