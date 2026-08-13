# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`testiam` is a minimal Nuxt 4 app whose sole purpose is to demonstrate/exercise the client side of `iam`'s SSO flow (the `iam` micro-app lives in the sibling `web/iam/` project). It is intentionally small — one authenticated page, one login page, and the server-side glue for an OAuth-like authorization-code flow with rotating refresh tokens.

The full client-integration contract this app implements is documented in `IAM_CLIENT_IMPLEMENTATION.md` — read it before touching anything under `server/`. It specifies exactly which checks are required (state, nonce, aud, exp) and which Phase 1 gaps to design around (no JWKS/signature verification, no backchannel logout, `not_authenticated_url` is registered but never used by `iam` itself).

## Commands

```bash
npm install
npm run dev         # start dev server on http://localhost:3000
npm run build        # production build
npm run preview      # preview the production build
npm run generate      # static generation
npm run typecheck     # nuxi typecheck (vue-tsc)
```

No test suite or lint script is configured in `package.json`.

## Configuration

Runtime config is defined in `nuxt.config.ts` and populated from `.env` (see `.env.example`):

- `NUXT_IAM_URL`, `NUXT_IAM_APP_ID`, `NUXT_IAM_CLIENT_SECRET` — server-only, obtained once from `iam`'s `npm run register-app` (never exposed to the client, never committed).
- `NUXT_AUTH_AUTHENTICATED_PATH` — the path on this app's own origin that `iam` redirects back to with `?code=&state=` (default `/`). Must exactly match the `authenticated_url` registered with `iam`.
- `NUXT_PUBLIC_AUTH_LOGIN_PATH` — the not-authenticated/login page path (default `/login`), exposed to the client via `runtimeConfig.public`.

## Architecture

The authenticated page and the OAuth callback are the same route (`/`, per `authenticatedPath`) — there is no separate `/callback` endpoint. This shapes how the flow is wired:

- **`server/middleware/auth.ts`** runs on every request. If `?code=&state=` are present, it treats the request as an SSO callback (`handleAuthCallback`): validates the stored `state`/`nonce` attempt cookie, exchanges the code via `exchangeCode`, decodes the `id_token` and checks `nonce`/`aud`/`exp`, creates a session, then redirects back to the same path stripped of the query string. Otherwise, if the request path is the configured `authenticatedPath` and there's no valid session, it redirects to the login path.
- **`server/utils/auth.ts`** holds all the stateless helpers and the session store: attempt generation/cookie (`iam_attempt`), the `POST /token` calls for both `authorization_code` and `refresh_token` grants, JWT payload decoding (decode-only — no signature verification, see Phase 1 gaps), and session CRUD backed by Nitro's `useStorage('iam:sessions')` (in-memory — sessions do not survive a server restart) with the `iam_session` cookie holding the session id. `getIamSession` transparently refreshes an expired access token (rotating the refresh token) or destroys the session if refresh fails.
- **`server/api/auth/login.get.ts`** — starts a fresh attempt and redirects to `iam`'s `GET /auth`, or short-circuits straight to `authenticatedPath` if a session already exists.
- **`server/api/auth/logout.post.ts`** / **`server/api/auth/session.get.ts`** — destroy/read the local session. Logout is local-only; it does not touch `iam`'s own session or revoke the refresh token there.
- **`composables/useAuth.ts`** — client-side wrapper (`useState('auth-user')`) around `/api/auth/session` and `/api/auth/logout`, used by `pages/index.vue` and indirectly by `pages/login.vue`.

When changing any validation step (state/nonce/aud/exp checks, cookie flags, refresh rotation), keep `server/middleware/auth.ts` and `server/utils/auth.ts` in sync with the corresponding checklist item in `IAM_CLIENT_IMPLEMENTATION.md`, and update that doc if behavior intentionally diverges from it.
