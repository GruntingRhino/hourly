# Canvas integration evidence — 2026-09-07

Raw logs for the Canvas LMS sandbox unblock and the real GoodHours → Canvas OAuth
integration run. No credentials appear in any file here (scanned before commit); tokens are
referenced only by id or byte length.

| File | What it proves |
|---|---|
| `diag.log` | The stale-shard symptom: `switchman_shards` holds one row `id=1 default=true`, yet `Shard.default` is the `Switchman::DefaultShard` sentinel, so `Account.default.id` globalises to `10000000000001` while `accounts` holds local ids `[0,1,2]`. |
| `diag2.log` | The root cause: `Shard.default(reload: true)` returns `Switchman::Shard id=1` and `Account.default.id` becomes `1`. The data was never corrupt — the default shard was memoized at boot, before `db:initial_setup` created the shard row at 03:53:43. |
| `unblock.log` | The non-destructive fix: stop the stale Spring preloader, confirm a fresh boot resolves the DB-backed shard, restart `web`, then mint an admin API token — `DK_ID=7 dk_root=1`, `TOKEN_ID=1 token_root=1`. The `PG::ForeignKeyViolation` is gone. No database was dropped. |
| `flow.log` | A second, separate defect (an account-scoped `DeveloperKey` needs a `DeveloperKeyAccountBinding` in state `on`), then the authenticated REST API at 200 and the synthetic course / student / enrollment / roster read. |
| `tunnel.log` | Loopback-only reachability: a separate `alpine/socat` container publishes `127.0.0.1:8900 → canvas-lms-web-1:80` on GODPC. Nothing bound to a public interface; Canvas itself gained no port mapping. |
| `goodhours-canvas-oauth-integration.log` | The real end-to-end integration: OAuth authorization-code exchange (not the mock mode), `status CONNECTED mode OAUTH`, the synthetic course read back **from the live Canvas**, `preview`/`apply` COMPLETED with `cohortsCreated:1 teacherAssignmentsCreated:1 invitationsCreated:1 errors:0`, then `disconnect` → `DISCONNECTED`. |
| `prior-a11y-vacuous-opportunity-scan.txt` | Retained counter-evidence for an unrelated, still-open gap: the opportunity-detail axe test passing while scanning nothing (`No opportunity links found on browse page — skipping navigation ✓`). Do not count that scan as verified. |

## Constraints honoured

- Inherited Canvas database preserved; no `db:drop`, no row deletions beyond the QA-only
  developer keys and access tokens this session minted (`REMOVED=AT1,AT2,DK9,DK7`).
- GoodHours' SSRF guard was **not** modified. `server/src/lib/lmsOutboundSecurity.ts` already
  permits an http/loopback LMS origin only when `!isPubliclyDeployed()` *and*
  `LMS_ALLOW_TEST_ORIGINS === "true"` *and* the origin is in `LMS_TEST_ALLOWED_ORIGINS`. Those
  were set on the isolated QA API only; production behaviour is unchanged.
- The Canvas-side login ran on GODPC against the synthetic sandbox admin this sandbox created,
  so that password never left that host. Only the short-lived authorization code crossed.
- No privileged container, no public port binding, no `prune`, and the unrelated
  `elegant_merkle` container was never touched.

Full narrative, including the two open test gaps, is in
`/home/opc/goodhours-claude-completion/AUTONOMOUS-STATUS.md`.
