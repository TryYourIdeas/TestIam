# CLIENT_IMPLEMENTATION.md

What an application must implement to authenticate users through `iam`'s SSO flow. This describes the **client side** of the flow — everything in this doc runs in the client app's own codebase, not in `iam`. Endpoints and payload shapes below are taken directly from `iam`'s implementation (`server/routes/auth.get.ts`, `server/routes/token.post.ts`), not from the aspirational design in `docs/use-cases.md` — where the two differ, this doc describes what actually runs today.

TypeScript examples are framework-agnostic (plain `fetch` + generic request/cookie helpers) so they can be adapted to any backend — Nitro, Express, etc.

## Implementation checklist

Everything below must exist in the client app's own codebase. Section references point to where each item is explained.

**Pages/routes**
- [ ] **Authenticated page** at the exact URL registered as `authenticated_url` (§0, §2). This route is *both* the OAuth callback and the app's logged-in page — it must perform the full token exchange and validation before rendering as "logged in."
- [ ] **Not-authenticated page** at the URL registered as `not_authenticated_url` (§0). Reached only by the client app's own redirects on a failed/rejected login (§2) — `iam` does not redirect here itself (see "Known Phase 1 gaps").

**Login initiation (§1)**
- [ ] Generate a cryptographically random `state` and `nonce` per login attempt.
- [ ] Persist `state`/`nonce` server-side (httpOnly cookie or session store) keyed to the browser, with a short expiry.
- [ ] Redirect the browser to `iam`'s `GET /auth` with `app_id`, `state`, `nonce`.

**Callback handling on the authenticated page (§2)**
- [ ] Read `code` and `state` from the query string.
- [ ] Reject (redirect to `not_authenticated_url`) if `code`, `state`, or the stored attempt is missing.
- [ ] Reject if returned `state` doesn't match the stored `state` (CSRF check).
- [ ] Exchange `code` via `POST /token` (`grant_type: authorization_code`) using `client_id`/`client_secret`.
- [ ] Reject if the token exchange fails.
- [ ] Decode  the `id_token` and check `nonce`, `aud`, and `exp`.
- [ ] On success, create the app's own local session; store `refresh_token` server-side only, never expose it to the browser.
- [ ] Delete the stored `state`/`nonce` attempt cookie.
- [ ] Strip `?code=&state=` from the URL after handling so a page refresh doesn't replay a consumed code.

**Token refresh (§3)**
- [ ] Implement refresh using `POST /token` (`grant_type: refresh_token`) before/when the access token expires.
- [ ] Always overwrite the stored refresh token with the rotated one from the response.
- [ ] On refresh failure, invalidate the local session and send the user through login (§1) again.

**Logout (§4)**
- [ ] Clear the local session and discard the stored refresh token.
- [ ] Don't expect this to affect the user's `iam`-level session or to revoke the refresh token on `iam`'s side (no backchannel logout).

**Configuration & registration (§0)**
- [ ] Register the app once per environment via `register-app` to obtain `app_id` and `client_secret`.
- [ ] Store `IAM_URL`, `IAM_APP_ID`, `IAM_CLIENT_SECRET` in the client app's own secret management — never in source control, never sent to the browser.
- [ ] Ensure the registered `authenticated_url` exactly matches the deployed authenticated page's URL — `iam` will not honor any other redirect target.

**Error handling (Error reference table)**
- [ ] Handle all `POST /token` error responses (`invalid_client`, `invalid_request`, `invalid_grant`, `unsupported_grant_type`) per the table's guidance.
- [ ] Do not retry a used/expired authorization code — it's single-use.

## 0. Prerequisites

Someone with access to `iam`'s database registers the app once per environment:

```bash
npm run register-app -- <app_id> <app_name> <authenticated_url> <not_authenticated_url>
```

This prints a `client_secret` **once** — it is not retrievable later. Store it in the client app's own secret management (environment variable, secrets manager), never in source control, never sent to the browser.

```typescript
// client app's env
interface IamConfig {
  IAM_URL: string          // e.g. "https://iam.tryyourideas.com"
  IAM_APP_ID: string       // the app_id used at registration
  IAM_CLIENT_SECRET: string
}
```

`authenticated_url` at registration must exactly match the app's own URL that will receive the authorization code (see step 2) — `iam` does not accept or trust any redirect target supplied at request time, only the one registered in advance.

## 1. Initiate login: redirect to `GET /auth`

When a user needs to authenticate (no valid local session), the client app:

1. Generates `state` and `nonce` — cryptographically random, unique per attempt.
2. Persists both **server-side**, associated with this browser (e.g. a short-lived httpOnly cookie, or a server-side session store) — needed to validate the callback in step 2.
3. Redirects the browser to `iam`.

```typescript
import { randomBytes } from 'node:crypto'

interface AuthAttempt {
  state: string
  nonce: string
}

function startLogin(): { redirectUrl: string; attempt: AuthAttempt } {
  const attempt: AuthAttempt = {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
  }

  const redirectUrl =
    `${IAM_URL}/auth?app_id=${encodeURIComponent(IAM_APP_ID)}` +
    `&state=${encodeURIComponent(attempt.state)}` +
    `&nonce=${encodeURIComponent(attempt.nonce)}`

  return { redirectUrl, attempt }
}
```

```typescript
// example route handler (framework-agnostic shape)
async function handleLoginStart(req: Request, res: ResponseLike) {
  const { redirectUrl, attempt } = startLogin()

  // Store server-side, e.g. as a short-lived httpOnly cookie:
  setCookie(res, 'iam_attempt', JSON.stringify(attempt), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60, // the flow should complete within minutes; iam's own auth code expires in 60s
    path: '/',
  })

  redirect(res, redirectUrl)
}
```

What happens next is entirely inside `iam`: it either recognizes an existing `iam` session and redirects back immediately, or shows its own login UI (email + 6-digit code) and redirects back once the user completes it. The client app has no visibility into or control over that part.

## 2. Handle the callback at `authenticated_url`

`iam` redirects the browser **directly to the registered `authenticated_url`**, with the code and state as query parameters:

```
GET https://<authenticated_url>?code=<authorization-code>&state=<state>
```

There is no separate callback endpoint — `authenticated_url` is both where the code arrives and the app's actual logged-in page. The handler for that route must do the exchange before rendering anything as "logged in."

```typescript
interface TokenResponse {
  token: string           // access token (JWT)
  id_token: string        // identity token (JWT) — only present on the authorization_code grant
  refresh_token: string
  user_email: string
  expires_in: number       // seconds (900 today)
}

interface TokenErrorResponse {
  error: string            // e.g. "invalid_grant", "invalid_client", "invalid_request"
  message: string
}

async function exchangeCode(code: string): Promise<TokenResponse> {
  const response = await fetch(`${IAM_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: IAM_APP_ID,
      client_secret: IAM_CLIENT_SECRET,
    }),
  })

  if (!response.ok) {
    const error = (await response.json()) as TokenErrorResponse
    throw new Error(`Token exchange failed: ${error.error} — ${error.message}`)
  }

  return (await response.json()) as TokenResponse
}
```

```typescript
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const [, payloadPart] = jwt.split('.')
  return JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
}

async function handleAuthenticatedUrl(req: Request, res: ResponseLike) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const attemptRaw = getCookie(req, 'iam_attempt')
  if (!code || !state || !attemptRaw) {
    return redirect(res, NOT_AUTHENTICATED_URL) // nothing to validate against — treat as failed
  }

  const attempt: AuthAttempt = JSON.parse(attemptRaw)
  if (state !== attempt.state) {
    // state mismatch: possible CSRF — reject outright, do not proceed to token exchange
    return redirect(res, NOT_AUTHENTICATED_URL)
  }

  let tokens: TokenResponse
  try {
    tokens = await exchangeCode(code)
  } catch {
    return redirect(res, NOT_AUTHENTICATED_URL)
  }

  const idClaims = decodeJwtPayload(tokens.id_token) as {
    sub: string
    email: string
    aud: string
    iss: string
    exp: number
    nonce: string
  }

  if (idClaims.nonce !== attempt.nonce) {
    // nonce mismatch: reject — do not create a session
    return redirect(res, NOT_AUTHENTICATED_URL)
  }
  if (idClaims.aud !== IAM_APP_ID) {
    return redirect(res, NOT_AUTHENTICATED_URL)
  }
  if (Date.now() >= idClaims.exp * 1000) {
    return redirect(res, NOT_AUTHENTICATED_URL)
  }

  // Passed all checks — create the app's own local session.
  await createLocalSession(res, {
    username: idClaims.sub,
    email: tokens.user_email,
    refreshToken: tokens.refresh_token,       // store server-side only, never send to the browser
    accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
  })

  deleteCookie(res, 'iam_attempt')

  // Optional: redirect to the same path without ?code=&state= so a page
  // refresh doesn't try to re-use an already-consumed code.
  redirect(res, url.pathname)
}
```

**Important limitation, not a choice made by this doc:** `iam`'s Phase 1 tokens are signed HS256 with a secret held only by `iam` — there is no JWKS endpoint yet (that's tracked in `docs/pending-tasks.md` under SSO Phase 2). The client app **cannot cryptographically verify the JWT signature** with what it has; `decodeJwtPayload` above only decodes, it does not verify. The actual trust boundary in Phase 1 is the `POST /token` call itself: it's a direct, authenticated (`client_secret`), TLS-protected, server-to-server call to `iam`, so the token is trusted because of *how it was obtained*, not because its signature was checked locally. Still validate `nonce`, `aud`, and `exp` from the decoded payload — those are cheap, meaningful checks independent of signature verification, and they're the ones use-cases.md's AC4/AC6 actually call for.

## 3. Refreshing the access token

When the access token expires (`expires_in` seconds after issuance), exchange the stored refresh token for a new one. Note the response shape differs slightly — no `id_token` on this grant:

```typescript
interface RefreshResponse {
  token: string
  refresh_token: string    // rotated — the old one is now invalid, store this one going forward
  user_email: string
  expires_in: number
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const response = await fetch(`${IAM_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: IAM_APP_ID,
      client_secret: IAM_CLIENT_SECRET,
    }),
  })

  if (!response.ok) {
    // Refresh token invalid/expired/already-rotated — the local session
    // cannot be extended. Invalidate it and send the user through step 1 again.
    throw new Error('Refresh failed')
  }

  return (await response.json()) as RefreshResponse
}
```

Refresh tokens rotate on every use (`server/utils/refreshTokens.ts`): the response's `refresh_token` is a **new** value, and the one just spent is now revoked. Always overwrite the stored refresh token with the new one — reusing an old one will fail.

## 4. Logout

Logout is entirely local to the client app in Phase 1 — clear its own session, discard the stored refresh token. There is no endpoint on `iam` to proactively revoke a specific app's refresh token, and logging the user out of the app does not affect their `iam`-level session (the browser's own `iam` cookie, if any, is untouched). Backchannel logout propagation is a Phase 2 item (`docs/pending-tasks.md`).

```typescript
async function logout(res: ResponseLike) {
  await destroyLocalSession(res)
  // The app's own refresh token becomes orphaned but not explicitly revoked —
  // it will simply go unused until it expires (30 days from issuance).
}
```

## Error reference

Every error from `POST /token` is a JSON body `{ error, message }` with one of these HTTP statuses:

| HTTP status | `error` | When | What to do |
|---|---|---|---|
| 401 | `invalid_client` | Missing or wrong `client_id`/`client_secret` | Configuration bug in the client app — this should never happen in production once deployed correctly. |
| 400 | `invalid_request` | Missing `code` (authorization_code grant) or `refresh_token` (refresh_token grant) | Client-side bug — the request is malformed. |
| 400 | `invalid_grant` | Code doesn't exist, already used, expired (60s TTL), or belongs to a different `client_id` | Treat as failed login — redirect to `not_authenticated_url`. Do not retry with the same code; it's single-use. |
| 401 | `invalid_grant` | Refresh token doesn't exist, expired, already rotated, or belongs to a different `client_id` | The session can't be extended — invalidate it locally and send the user through step 1 again. |
| 400 | `unsupported_grant_type` | `grant_type` isn't `authorization_code` or `refresh_token` | Client-side bug. |

`GET /auth` itself (step 1) can fail before the browser ever reaches the client app's own domain — a 400 (missing `app_id`/`state`/`nonce`) or 404 (unregistered `app_id`) renders as an `iam`-hosted error, not something the client app's code ever sees or handles.

## Known Phase 1 gaps to design around

- **`not_authenticated_url` is registered but `iam` never redirects there.** Every failure path inside `iam`'s own login UI (3 wrong codes, etc.) currently redirects to `iam`'s own hardcoded error page regardless of whether the login was part of an SSO flow — it does not know about or use the calling app's `not_authenticated_url`. The client app's `not_authenticated_url` is only ever reached by the client app's *own* code (as shown in step 2's validation failures) — not by `iam` redirecting there directly. Don't build anything that assumes `iam` will send failed SSO attempts back to the app.
- **No signature verification available** (see step 2) — no JWKS until Phase 2.
- **No token introspection endpoint** — if the app needs to check whether a token/session is still valid before its stated expiry (e.g., to detect revocation), there's nothing to call; expiry-based checks are all that's available today.
- **No backchannel logout** (see step 4).

See `docs/pending-tasks.md` for the full list and `docs/superpowers/specs/2026-08-12-sso-phase1-design.md` for why Phase 1 is scoped this way.
