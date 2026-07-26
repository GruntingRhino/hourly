import test from "node:test";
import assert from "node:assert/strict";
import { isRetryableSerializationError } from "../src/lib/serializableTransaction";

test("recognizes Prisma P2034 conflicts across runtime package boundaries", () => {
  assert.equal(isRetryableSerializationError({ code: "P2034", meta: {} }), true);
});

test("recognizes raw PostgreSQL serialization failures wrapped as P2010", () => {
  assert.equal(isRetryableSerializationError({ code: "P2010", meta: { code: "40001" } }), true);
});

test("does not retry unrelated Prisma errors", () => {
  assert.equal(isRetryableSerializationError({ code: "P2002" }), false);
});
