# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`testiam` is a minimal Nuxt 4 app whose sole purpose is to demonstrate/exercise the client side of `iam`'s SSO flow (the `iam` micro-app lives in the sibling `web/iam/` project). It is intentionally small — a landing page, a dedicated OAuth-callback page, a dashboard, a not-authenticated page, and whatever app-specific UI sits on top of the shared auth integration.

The actual client-side implementation of the SSO flow (server routes, OAuth-exchange middleware, session store, `useAuth` composable) is **not** in this repo — it's the `nuxt-iam-client` Nuxt module at `../lib/nuxt-iam-client` (consumed via `"nuxt-iam-client": "file:../lib/nuxt-iam-client"` in `package.json`), extracted so other Nuxt apps in `web/` can reuse the same integration. This app only owns pages/components; read `../lib/nuxt-iam-client/README.md` before touching anything auth-related that isn't page/UI-specific.

The full client-integration contract the module implements is documented in `IAM_CLIENT_IMPLEMENTATION.md` — it specifies exactly which checks are required (state, nonce, aud, exp) and which Phase 1 gaps to design around (no JWKS/signature verification, no backchannel logout, `not_authenticated_url` is registered but never used by `iam` itself).

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

No lint script is configured in `package.json`. Unit tests use Vitest with `@nuxt/test-utils`'s `environment: 'nuxt'` and `@testing-library/vue`, mirroring the sibling `iam` project's setup — see `vitest.config.ts` and `test/setup.ts`. Convention: test presentational components (`components/`) and composables directly; pages stay thin data-fetching/redirect wrappers and aren't unit-tested directly (same convention `iam` uses). `useAuth` itself is tested here even though it's defined in the module, since `nuxt-iam-client` auto-imports it as a real global via `addImportsDir` — `composables/useAuth.test.ts` calls it with no import statement, same as a page would.

## Configuration

`nuxt.config.ts` registers `modules: ['nuxt-iam-client']` and passes its options under the `iamClient` key, populated from `.env` (see `.env.example`):

- `NUXT_IAM_URL`, `NUXT_IAM_APP_ID`, `NUXT_IAM_APP_SECRET` — server-only, obtained once from `iam`'s admin dashboard (never exposed to the client, never committed). Map to `iamClient.iam.{url,appId,appSecret}`.
- The module's four path options (`authenticatedPath`, `afterLoginPath`, `notAuthenticatedPath`, `afterLogoutPath`) are left at their defaults in `nuxt.config.ts` — they already match this app's routes (`/authenticated`, `/dashboard`, `/not-authenticated`, `/`), so there's nothing to override. `authenticatedPath` must exactly match the `authenticated_url` registered with `iam`.

## Architecture

The OAuth callback and the various auth states each have their own dedicated page — no route does double duty. Everything server-side and the `useAuth` composable come from `nuxt-iam-client`; only the pages below are this repo's own code:

- **`pages/index.vue`** redirects to `/dashboard` if already signed in, otherwise renders `AuthActions` (Login/Register buttons, both pointing at `/api/auth/login` — `iam` has no way to deep-link straight to its signup tab).
- **`pages/authenticated.vue`** (the registered `authenticated_url`) — by the time this renders, the module's middleware has already exchanged the code and created a session (or the request arrived with no code/state at all). Redirects to `/dashboard` or `/not-authenticated` depending on session state.
- **`pages/dashboard.vue`** redirects to `/not-authenticated` if no session, otherwise renders `DashboardCard` (user data + logout button).
- **`pages/not-authenticated.vue`** renders `NotAuthenticatedNotice` unconditionally — landing spot for any failed/rejected login.

All four pages call `useAuth().fetchSession()` to check session state — this is the module's composable, auto-imported, no explicit import needed.

When changing any validation step (state/nonce/aud/exp checks, cookie flags, refresh rotation), that logic lives in `../lib/nuxt-iam-client/src/runtime/`, not here — keep it in sync with the corresponding checklist item in `IAM_CLIENT_IMPLEMENTATION.md`, and update that doc if behavior intentionally diverges from it.
