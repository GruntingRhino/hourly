import crypto from "crypto";
import jwt from "jsonwebtoken";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const GITHUB_OIDC_AUDIENCE = "goodhours-internal-cron";
const GITHUB_ALLOWED_REPOSITORY = "GruntingRhino/Hourly";

type Jwk = {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type JwksResponse = {
  keys: Jwk[];
};

type GithubOidcPayload = jwt.JwtPayload & {
  repository?: string;
  job_workflow_ref?: string;
};

let jwksCache: { expiresAt: number; keys: Jwk[] } | null = null;

async function getJwks(): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const response = await fetch(GITHUB_OIDC_JWKS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub OIDC JWKS fetch failed with ${response.status}`);
  }

  const payload = await response.json() as JwksResponse;
  const ttlMs = 60 * 60 * 1000;
  jwksCache = {
    expiresAt: now + ttlMs,
    keys: payload.keys ?? [],
  };
  return jwksCache.keys;
}

export async function verifyGithubActionsOidcToken(token: string): Promise<boolean> {
  const decoded = jwt.decode(token, { complete: true });
  const headerKid = decoded && typeof decoded === "object" ? decoded.header?.kid : null;
  if (!headerKid) return false;

  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === headerKid);
  if (!jwk) return false;

  const publicKey = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
  const verified = jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: GITHUB_OIDC_ISSUER,
    audience: GITHUB_OIDC_AUDIENCE,
  }) as GithubOidcPayload;

  if (verified.repository !== GITHUB_ALLOWED_REPOSITORY) {
    return false;
  }

  return true;
}
