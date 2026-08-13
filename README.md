# Nuxt 4 + IAM SSO

Nuxt 4 app (migrated from the Vue 3 + Vite starter) that authenticates users through the
`iam` SSO flow described in `IAM_CLIENT_IMPLEMENTATION.md`.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with the values printed once by `iam`'s `npm run register-app`:

```ini
NUXT_IAM_URL=https://iam.tryyourideas.com
NUXT_IAM_APP_ID=<app_id>
NUXT_IAM_CLIENT_SECRET=<client_secret>
```

The `authenticated_url` registered with `iam` must point at `NUXT_AUTH_AUTHENTICATED_PATH`
on this app's own origin (default `/`), since that is where the authorization code is
delivered.

## Development

```bash
npm run dev
```

Start the development server on `http://localhost:3000`.

## Production

```bash
npm run build
npm run preview
```

## Auth flow

| Route | Purpose |
|---|---|
| `/` | Authenticated page (also the `authenticated_url` callback target). |
| `/login` | Not-authenticated page — links to `/api/auth/login`. |
| `/api/auth/login` | Starts the flow: generates `state`/`nonce`, stores them in a short-lived httpOnly cookie, redirects to `iam`. |
| `/api/auth/logout` (POST) | Destroys the local session (does not affect the `iam`-level session). |
| `/api/auth/session` | Returns the current user (`username`, `email`) or `null`. |

Server-side (`server/`):

- `server/utils/auth.ts` — attempt/state/nonce generation, code exchange, refresh, JWT payload decoding, and the server-side session store.
- `server/middleware/auth.ts` — validates the `?code=&state=` callback (state, nonce, aud, exp), exchanges the code, creates the session, and guards the authenticated path.

Notes (Phase 1 of `iam`):

- Refresh tokens rotate on every use and are stored server-side only (never sent to the browser).
- Sessions are kept in Nitro's in-memory storage (`iam:sessions`); they do not survive a server restart in this Phase 1 demo.
- JWT signatures cannot be verified locally yet (no JWKS); trust is established by the authenticated `POST /token` exchange, plus `nonce`/`aud`/`exp` checks.
