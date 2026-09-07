import { createPrivateCacheDir, TOKEN_CACHE_DIR_ENV } from "./tokenCacheDir";

/**
 * Mints the run-scoped private token-cache directory and publishes its path in
 * the environment. Playwright forks its workers from this process, so every
 * worker — including one restarted after a failure — sees the same directory
 * and the same run's tokens, and no other run's.
 */
export default function globalSetup(): void {
  process.env[TOKEN_CACHE_DIR_ENV] = createPrivateCacheDir();
}
