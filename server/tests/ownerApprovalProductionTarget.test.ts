import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isProductionOwnerApprovalTarget } from "../src/lib/isProdLike";

/**
 * Regression: routes/auth.ts's POST /ownership-approval/resend re-derived the
 * "is this the real goodhours.app deployment" check with its own regex literal
 * and wrote `/(^|\\.)goodhours\\.app$/i` — doubled backslashes, so the pattern
 * required a literal backslash in the hostname and could never match
 * `goodhours.app`. In production the route therefore always took the
 * development-bypass branch and returned HTTP 200 `{ delivery: "bypass" }`
 * WITHOUT sending anything — after it had already rotated
 * `ownershipApprovalToken` and stamped `ownershipApprovalLastSentAt`, i.e. it
 * consumed the 15-minute cooldown and invalidated the approval link that had
 * previously been emailed to the business owner. The two sibling call sites
 * (signup in auth.ts, google register-school) had the correct literal, which is
 * exactly the drift shape lib/isProdLike.ts exists to prevent.
 */

const serverSrcRoot = path.resolve(__dirname, "../src");

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key] as string;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    }
  }
}

test("the production owner-approval target matches the real goodhours.app hosts", () => {
  withEnv({ APP_ENV: "production", NODE_ENV: undefined, VERCEL_ENV: undefined }, () => {
    assert.equal(isProductionOwnerApprovalTarget("https://goodhours.app"), true);
    assert.equal(isProductionOwnerApprovalTarget("https://www.goodhours.app"), true);
    assert.equal(isProductionOwnerApprovalTarget("https://goodhours.app/"), true);
  });
});

test("the production owner-approval target rejects lookalike, preview and local hosts", () => {
  withEnv({ APP_ENV: "production", NODE_ENV: undefined, VERCEL_ENV: undefined }, () => {
    assert.equal(isProductionOwnerApprovalTarget("https://evilgoodhours.app"), false);
    assert.equal(isProductionOwnerApprovalTarget("https://goodhours.app.attacker.test"), false);
    assert.equal(isProductionOwnerApprovalTarget("https://hourly-dev.vercel.app"), false);
    assert.equal(isProductionOwnerApprovalTarget("http://localhost:5173"), false);
    assert.equal(isProductionOwnerApprovalTarget("not a url"), false);
  });
});

test("the production owner-approval target is false when the environment is not production-like", () => {
  withEnv({ APP_ENV: "development", NODE_ENV: "test", VERCEL_ENV: undefined }, () => {
    assert.equal(isProductionOwnerApprovalTarget("https://goodhours.app"), false);
  });
});

test("no route re-derives the goodhours.app production-host check with its own regex", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
    }
  };
  walk(serverSrcRoot);

  const canonical = path.join(serverSrcRoot, "lib/isProdLike.ts");
  const offenders: string[] = [];
  for (const file of files) {
    if (file === canonical) continue;
    if (/goodhours[^"'\n]{0,6}\.app\$/.test(fs.readFileSync(file, "utf8"))) {
      offenders.push(path.relative(serverSrcRoot, file));
    }
  }
  assert.deepEqual(offenders, [], `these files re-derive the goodhours.app host check instead of importing isProductionOwnerApprovalTarget: ${offenders.join(", ")}`);
});
