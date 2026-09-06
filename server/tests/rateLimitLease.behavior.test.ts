import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(new URL("./rateLimitLease.helper.ts", import.meta.url));
const run = (modulePath: string, scenario: string) => {
  const output = execFileSync(process.execPath, ["--import", "tsx", helper, modulePath, scenario], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, NODE_ENV: "test", APP_ENV: "development" },
    encoding: "utf8",
    timeout: 10_000,
  });
  const line = output.split("\n").find((entry) => entry.startsWith("RESULT "));
  assert.ok(line, `missing RESULT in helper output: ${output}`);
  return JSON.parse(line.slice("RESULT ".length)) as Record<string, unknown>;
};

test("release uses the acquired Upstash bucket across a window boundary", () => {
  const result = run("../src/middleware/rateLimit.ts", "cross-window");
  assert.deepEqual(result, { oldBucket: 0, newBucket: 1 });
});

test("concurrent releases never decrement below zero", () => {
  const result = run("../src/middleware/rateLimit.ts", "concurrent-release");
  assert.deepEqual(result, { remaining: 0 });
});

test("release does not recreate an expired Upstash key", () => {
  const result = run("../src/middleware/rateLimit.ts", "expired-release");
  assert.deepEqual(result, { remaining: 0, recreated: false });
});

test("an HTTP 200 Upstash EVAL error is conservative", () => {
  const result = run("../src/middleware/rateLimit.ts", "eval-error");
  assert.deepEqual(result, { count: 1, releaseError: true });
});

test("failed responses remain counted when successful responses are skipped", () => {
  const result = run("../src/middleware/rateLimit.ts", "failed-response");
  assert.deepEqual(result, { first: 500, second: 429, count: 1 });
});
