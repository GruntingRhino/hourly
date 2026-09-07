import { removePrivateCacheDir, TOKEN_CACHE_DIR_ENV } from "./tokenCacheDir";

/** Removes the run's token cache so no bearer token survives the run on disk. */
export default function globalTeardown(): void {
  removePrivateCacheDir(process.env[TOKEN_CACHE_DIR_ENV]);
  delete process.env[TOKEN_CACHE_DIR_ENV];
}
