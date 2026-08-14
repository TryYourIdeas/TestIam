# Nuxt 4 + IAM SSO

Nuxt 4 app (migrated from the Vue 3 + Vite starter) that authenticates users through the
`iam` SSO flow described in `IAM_CLIENT_IMPLEMENTATION.md`.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with the values printed once by `iam`'s admin dashboard
(`https://iam.tryyourideas.com/admin` — see `iam/CONFIG.md`, "Registering SSO
client applications"; the old `register-app` CLI script is retired):

```ini
NUXT_IAM_URL=https://iam.tryyourideas.com
NUXT_IAM_APP_ID=<app_id>
NUXT_IAM_CLIENT_SECRET=<client_secret>
```

The `authenticated_url` registered with `iam` must point at
`NUXT_AUTH_AUTHENTICATED_PATH` on this app's own origin (default
`/authenticated`), since that is where the authorization code is delivered.

## Development

```bash
npm run dev
```

Start the development server on `http://localhost:3000`.

## Testing

```bash
npm test
```

Runs the vitest unit test suite (component and composable tests, using
`@testing-library/vue`).

## Production

```bash
npm run build
npm run preview
```

## Auth flow

| Route | Purpose |
|---|---|
| `/` | Landing page. Redirects to `/dashboard` if already signed in; otherwise shows Login/Register buttons (both point at `/api/auth/login` — `iam` has no way to deep-link straight to its signup tab, see `docs/superpowers/specs/2026-08-13-auth-pages-refactor-design.md`). |
| `/authenticated` | The `authenticated_url` callback target. Exchanges the code for a session, then redirects to `/dashboard` or `/not-authenticated`. |
| `/not-authenticated` | Landing spot for any failed/rejected login. Links back to `/`. |
| `/dashboard` | Authenticated page — shows the signed-in user's data and a Logout button. |
| `/api/auth/login` | Starts the flow: generates `state`/`nonce`, stores them in a short-lived httpOnly cookie, redirects to `iam`. |
| `/api/auth/logout` (POST) | Destroys the local session (does not affect the `iam`-level session). |
| `/api/auth/session` | Returns the current user (`username`, `email`) or `null`. |

Server-side (`server/`):

- `server/utils/auth.ts` — attempt/state/nonce generation, code exchange, refresh, JWT payload decoding, and the server-side session store.
- `server/middleware/auth.ts` — handles the `?code=&state=` OAuth exchange (state, nonce, aud, exp checks), creates the session, and redirects to `/authenticated` on success or `/not-authenticated` on failure. Per-route session guarding lives in the pages themselves (`pages/authenticated.vue`, `pages/dashboard.vue`), not in this middleware.

Notes (Phase 1 of `iam`):

- Refresh tokens rotate on every use and are stored server-side only (never sent to the browser).
- Sessions are kept in Nitro's in-memory storage (`iam:sessions`); they do not survive a server restart in this Phase 1 demo.
- JWT signatures cannot be verified locally yet (no JWKS); trust is established by the authenticated `POST /token` exchange, plus `nonce`/`aud`/`exp` checks.
