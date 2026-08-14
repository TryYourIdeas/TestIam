# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`testiam` is a minimal Nuxt 4 app whose sole purpose is to demonstrate/exercise the client side of `iam`'s SSO flow (the `iam` micro-app lives in the sibling `web/iam/` project). It is intentionally small — a landing page, a dedicated OAuth-callback page, a dashboard, a not-authenticated page, and the server-side glue for an OAuth-like authorization-code flow with rotating refresh tokens.

The full client-integration contract this app implements is documented in `IAM_CLIENT_IMPLEMENTATION.md` — read it before touching anything under `server/`. It specifies exactly which checks are required (state, nonce, aud, exp) and which Phase 1 gaps to design around (no JWKS/signature verification, no backchannel logout, `not_authenticated_url` is registered but never used by `iam` itself).

## Commands

```bash
npm install
npm run dev         # start dev server on http://localhost:3000
npm run build        # production build
npm run preview      # preview the production build
npm run generate      # static generation
npm run typecheck     # nuxi typecheck (vue-tsc)
npm test              # vitest unit tests (components + composables)
```

No lint script is configured in `package.json`. Unit tests use Vitest with `@nuxt/test-utils`'s `environment: 'nuxt'` and `@testing-library/vue`, mirroring the sibling `iam` project's setup — see `vitest.config.ts` and `test/setup.ts`. Convention: test presentational components (`components/`) and composables directly; pages stay thin data-fetching/redirect wrappers and aren't unit-tested directly (same convention `iam` uses).

## Configuration

Runtime config is defined in `nuxt.config.ts` and populated from `.env` (see `.env.example`):

- `NUXT_IAM_URL`, `NUXT_IAM_APP_ID`, `NUXT_IAM_CLIENT_SECRET` — server-only, obtained once from `iam`'s admin dashboard (never exposed to the client, never committed).
- `NUXT_AUTH_AUTHENTICATED_PATH` — the path on this app's own origin that `iam` redirects back to with `?code=&state=` (default `/authenticated`). Must exactly match the `authenticated_url` registered with `iam`.

## Architecture

The OAuth callback and the various auth states each have their own dedicated page — no route does double duty:

- **`server/middleware/auth.ts`** runs on every request and *only* handles the OAuth exchange: if `?code=&state=` are present (`handleAuthCallback`), it validates the stored `state`/`nonce` attempt cookie, exchanges the code via `exchangeCode`, decodes and checks the `id_token` (`nonce`/`aud`/`exp`), creates a session, then redirects to `/authenticated` stripped of the query string. Any validation failure redirects to `/not-authenticated`. It does no per-path session guarding — that's each page's own job.
- **`server/utils/auth.ts`** holds the stateless helpers and the session store: attempt generation/cookie (`iam_attempt`), the `POST /token` calls for both `authorization_code` and `refresh_token` grants, JWT payload decoding (decode-only — no signature verification, see Phase 1 gaps), and session CRUD backed by Nitro's `useStorage('iam:sessions')` (in-memory — sessions do not survive a server restart) with the `iam_session` cookie holding the session id. `getIamSession` transparently refreshes an expired access token (rotating the refresh token) or destroys the session if refresh fails.
- **`server/api/auth/login.get.ts`** — starts a fresh attempt and redirects to `iam`'s `GET /auth`, or redirects straight to `/dashboard` if a session already exists.
- **`server/api/auth/logout.post.ts`** / **`server/api/auth/session.get.ts`** — destroy/read the local session. Logout is local-only; it does not touch `iam`'s own session or revoke the refresh token there.
- **`composables/useAuth.ts`** — client-side wrapper (`useState('auth-user')`) around `/api/auth/session` and `/api/auth/logout`. `fetchSession()` uses `useRequestFetch()` rather than the global `$fetch` — this matters during SSR, since `$fetch` does not forward the incoming request's cookies to internal API calls, which previously caused pages to render as logged-out even with a valid session.
- **Pages self-guard using `useAuth().fetchSession()`**: `pages/index.vue` redirects to `/dashboard` if already signed in, otherwise renders `AuthActions`. `pages/authenticated.vue` (the registered `authenticated_url`) redirects to `/dashboard` or `/not-authenticated` depending on session state. `pages/dashboard.vue` redirects to `/not-authenticated` if no session, otherwise renders `DashboardCard`. `pages/not-authenticated.vue` renders `NotAuthenticatedNotice` unconditionally.

When changing any validation step (state/nonce/aud/exp checks, cookie flags, refresh rotation), keep `server/middleware/auth.ts` and `server/utils/auth.ts` in sync with the corresponding checklist item in `IAM_CLIENT_IMPLEMENTATION.md`, and update that doc if behavior intentionally diverges from it.
