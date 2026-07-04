# JWT Secret Rotation Runbook

**Cadence:** quarterly, and immediately after any suspected exposure of `JWT_SECRET`
(leaked env file, compromised laptop, offboarded team member with production access).

**Downtime / user impact:** none. The server signs new tokens with `JWT_SECRET` and
verifies against both `JWT_SECRET` and `JWT_SECRET_PREVIOUS`
(`server/src/middleware/auth.ts` → `verifyToken`). Sessions issued before the
rotation keep working on the previous secret until they expire — token lifetime
is 7 days, so the overlap window only needs to last that long.

## Rotate (production, ~2 minutes)

Run from the repo root (the project is linked to Vercel via `.vercel/`):

```bash
# 1. Grab the CURRENT production secret — it becomes the "previous" secret.
#    This writes a temp file; delete it right after.
vercel env pull --environment=production /tmp/gh-prod-env
OLD_SECRET=$(grep '^JWT_SECRET=' /tmp/gh-prod-env | cut -d'"' -f2)
rm /tmp/gh-prod-env

# 2. Generate the new secret.
NEW_SECRET=$(openssl rand -hex 64)

# 3. Move current → previous, install the new secret.
vercel env rm JWT_SECRET_PREVIOUS production --yes 2>/dev/null  # ok if it doesn't exist yet
printf '%s' "$OLD_SECRET" | vercel env add JWT_SECRET_PREVIOUS production
vercel env rm JWT_SECRET production --yes
printf '%s' "$NEW_SECRET" | vercel env add JWT_SECRET production

# 4. Deploy so the new env takes effect (Vercel env changes apply on deploy).
vercel --prod

# 5. Clear the secrets from your shell history/session.
unset OLD_SECRET NEW_SECRET
```

## Verify

```bash
# Existing sessions still work: open the app in a browser that was already
# signed in — it should NOT be logged out.
# New logins work: sign in fresh; /api/auth/me returns 200.
curl -s https://goodhours.app/api/health
```

## Finish (7+ days later)

Once every token signed by the old secret has expired (7 days), remove the
fallback so a leaked old secret is fully dead:

```bash
vercel env rm JWT_SECRET_PREVIOUS production --yes
vercel --prod
```

## Emergency rotation (secret known compromised)

If the secret is *known* to be compromised, do NOT keep the old secret valid:

```bash
NEW_SECRET=$(openssl rand -hex 64)
vercel env rm JWT_SECRET_PREVIOUS production --yes 2>/dev/null
vercel env rm JWT_SECRET production --yes
printf '%s' "$NEW_SECRET" | vercel env add JWT_SECRET production
vercel --prod
unset NEW_SECRET
```

This signs everyone out immediately (all outstanding tokens fail verification).
That is the intended effect. Users simply log in again.

Per-user session revocation (e.g., one stolen token) does not need a secret
rotation — bump that user's `tokenVersion` in the database or suspend the
account; `authenticate` checks both on every request.

## Local development

Same idea in `server/.env`: set `JWT_SECRET_PREVIOUS` to the old value, put the
new value in `JWT_SECRET`, restart the dev server. Or just rotate `JWT_SECRET`
alone and re-login — dev sessions are disposable.
