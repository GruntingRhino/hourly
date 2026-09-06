import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const script = join(root, 'scripts/vercel-production-build.sh');
const manifestPath = join(root, 'scripts/vercel-production-migration-manifest.json');
chmodSync(script, 0o755);

function fakeTools() {
  const bin = mkdtempSync(join(tmpdir(), 'goodhours-build-gate-'));
  const calls = join(bin, 'calls');
  writeFileSync(join(bin, 'npx'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\ncase "$*" in *"migrate diff"*) printf "%s\\n" "-- This is an empty migration.";; esac\n');
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "npm $*" >> "$CALLS"\n');
  chmodSync(join(bin, 'npx'), 0o755);
  chmodSync(join(bin, 'npm'), 0o755);
  return { bin, calls };
}

function run(env, tools = false) {
  const extra = tools ? fakeTools() : null;
  return spawnSync('bash', [script], {
    cwd: root,
    env: { ...process.env, ...(extra ? { PATH: `${extra.bin}:${process.env.PATH}`, CALLS: extra.calls } : {}), ...env },
    encoding: 'utf8',
  });
}

const missingProject = run({ VERCEL_ENV: 'production', VERCEL_PROJECT_ID: '' });
assert.notEqual(missingProject.status, 0);
assert.match(missingProject.stderr, /VERCEL_PROJECT_ID is missing/);

const unknownEnv = run({ VERCEL_ENV: 'qa', VERCEL_PROJECT_ID: 'wrong' });
assert.notEqual(unknownEnv.status, 0);
assert.match(unknownEnv.stderr, /unknown VERCEL_ENV/);

const previewTools = fakeTools();
const preview = spawnSync('bash', [script], {
  cwd: root,
  env: { ...process.env, PATH: `${previewTools.bin}:${process.env.PATH}`, CALLS: previewTools.calls,
    VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: 'wrong-project', VERCEL_GIT_COMMIT_SHA: '' },
  encoding: 'utf8',
});
assert.equal(preview.status, 0, preview.stderr);
assert.match(preview.stdout + preview.stderr, /PRODUCTION_MIGRATION=skipped target=preview/);
assert.doesNotMatch(readFileSync(previewTools.calls, 'utf8'), /migrate deploy/);

const productionBase = {
  VERCEL_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_ZP9k4HEjRT8sMEKzsvcSsHXVMVai',
  VERCEL_GIT_COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
  DATABASE_URL: 'postgresql://disposable.invalid/goodhours_test',
};
for (const [label, env, expected] of [
  ['wrong project', { ...productionBase, VERCEL_PROJECT_ID: 'wrong-project' }, /project identity/],
  ['wrong SHA', { ...productionBase, VERCEL_GIT_COMMIT_SHA: 'not-a-sha' }, /commit identity/],
  ['missing DB', { ...productionBase, DATABASE_URL: '' }, /DATABASE_URL is unavailable/],
]) {
  const result = run(env, true);
  assert.notEqual(result.status, 0, label);
  assert.match(result.stderr, expected, label);
}

const originalManifest = readFileSync(manifestPath, 'utf8');
try {
  const altered = JSON.parse(originalManifest);
  altered.schema.sha256 = '0'.repeat(64);
  writeFileSync(manifestPath, JSON.stringify(altered, null, 2) + '\n');
  const result = run(productionBase, true);
  assert.notEqual(result.status, 0, 'schema mismatch');
  assert.match(result.stderr, /schema hash mismatch/);
} finally {
  writeFileSync(manifestPath, originalManifest);
}

const migrationPath = join(root, 'server/prisma/migrations/20260905100000_add_eligibility_attestation/migration.sql');
const originalMigration = readFileSync(migrationPath);
try {
  appendFileSync(migrationPath, '\n-- candidate gate mutation\n');
  const result = run(productionBase, true);
  assert.notEqual(result.status, 0, 'history mutation');
  assert.match(result.stderr, /migration hash mismatch/);
} finally {
  writeFileSync(migrationPath, originalMigration);
}

const valid = run(productionBase, true);
assert.equal(valid.status, 0, valid.stderr);
assert.match(valid.stdout, /PRODUCTION_REVIEWED_HISTORY_MATCH=verified count=70/);
assert.match(valid.stdout, /PRODUCTION_SCHEMA_MATCH=verified/);
console.log('PRODUCTION_BUILD_GATE_TEST=PASS');
