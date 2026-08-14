# Auth pages refactor

Split the single combined authenticated/login page into dedicated routes: a
landing page, an OAuth-callback page, a not-authenticated page, and a
dashboard.

## Routes

| Path | File | Purpose |
|---|---|---|
| `/` | `pages/index.vue` | Landing page. If a session already exists, redirect to `/dashboard`. Otherwise render **Login** and **Register** buttons, both linking to `/api/auth/login`. |
| `/authenticated` | `pages/authenticated.vue` (new) | The registered `authenticated_url` — the OAuth landing target. By the time this page renders, `server/middleware/auth.ts` has already exchanged the code and created a session (or the request arrived with no code/state). The page checks session state and redirects: authenticated → `/dashboard`, not authenticated → `/not-authenticated`. |
| `/not-authenticated` | `pages/not-authenticated.vue` (new) | Static message "No authenticated" + a "Go home" button → `/`. Landing spot for any failed/rejected flow. |
| `/dashboard` | `pages/dashboard.vue` (new) | Shows the user's data (`email`, `username`) + a Logout button. Guards itself: if no session, redirects to `/not-authenticated`. |
| `pages/login.vue` | — | Deleted — its role is absorbed by `/`'s buttons. |

### Why no deep link to iam's signup tab

`iam`'s `GET /auth` route (`iam/server/routes/auth.get.ts`) redirects
unauthenticated visitors to its own `/` page carrying only `app_id`/`state`.
That page's login/signup selector (`iam/app/composables/useAuth.ts`) is a
client-side tab that always defaults to `'login'` — there is no query
parameter to pre-select signup. So TestIam's Login and Register buttons
necessarily point at the same destination (`/api/auth/login`); the user picks
a tab once they land on `iam`'s own page. This is a deliberate, accepted
limitation, not a bug to fix here.

## Redirect flow

1. Visit `/` (no session) → Login/Register buttons, both → `/api/auth/login`.
2. `/api/auth/login` (server route): if a session already exists, redirect
   straight to `/dashboard`; otherwise generate a `state`/`nonce` attempt,
   store it in the `iam_attempt` cookie, redirect to `iam`'s `GET /auth`.
3. `iam` handles its own login/signup UI, then redirects the browser to the
   registered `authenticated_url` (`.../authenticated?code=&state=`).
4. `server/middleware/auth.ts` intercepts (code/state present): validates
   `state` against the stored attempt, exchanges the code, decodes and
   validates the `id_token` (`nonce`/`aud`/`exp`), creates the session,
   clears the attempt cookie, and redirects to `/authenticated` stripped of
   the query string. On any validation failure, redirects to
   `/not-authenticated` instead.
5. `pages/authenticated.vue` renders, calls `fetchSession()`: session exists
   → `navigateTo('/dashboard')`; no session → `navigateTo('/not-authenticated')`.
6. `pages/dashboard.vue` renders, calls `fetchSession()`: session exists →
   shows `user.email`/`user.username` + Logout button; no session →
   `navigateTo('/not-authenticated')`.
7. `pages/not-authenticated.vue`: static "No authenticated" message + "Go
   home" button → `navigateTo('/')`.
8. Logout button → `useAuth().logout()` → `POST /api/auth/logout` (destroys
   the session) → `navigateTo('/')`.

## Server-side changes

- **`server/middleware/auth.ts`** simplifies to only handle the
  `?code=&state=` exchange — this must happen server-side regardless of
  which page it lands on. It no longer does per-path session guarding; each
  protected page (`/authenticated`, `/dashboard`) guards itself via
  `useAuth().fetchSession()`, using the same `useRequestFetch()`-based
  pattern already fixed for SSR cookie forwarding. On failure, it redirects
  to `/not-authenticated` (replacing the old `/login?error=...` redirect).
- **`server/api/auth/login.get.ts`** — if a session already exists, redirect
  straight to `/dashboard` (skips the `/authenticated` hop entirely; no
  reason to replay it).
- **`composables/useAuth.ts`** — `logout()` redirects to `/` instead of the
  old `loginPath`.

## Config

- `NUXT_AUTH_AUTHENTICATED_PATH` updates from `/` to `/authenticated` in
  `.env` and `.env.example`. This is plausibly already what's registered
  with `iam` for this app (it would explain the earlier
  `VUE_ROUTER_R0004 No match found for location with path "/authenticated"`
  console warning), so this change alone may resolve that without touching
  `iam`'s registration.
- Drop `runtimeConfig.public.auth` (the `loginPath` value) entirely.
  `/dashboard`, `/not-authenticated`, and `/authenticated` are now fixed
  named routes rather than configurable ones, so hardcoding them in the
  handful of places that redirect avoids config/reality drift. Only the
  registered `authenticated_url`'s path stays env-driven
  (`runtimeConfig.auth.authenticatedPath`), since it's the one contract with
  `iam` that can legitimately differ per environment/deployment.

## Out of scope

- Changing `iam`'s registration for this app (`authenticated_url`), or
  adding a signup-mode deep link to `iam` itself — both are changes to a
  separate project and weren't asked for here.
- Distinguishing *why* a flow failed on `/not-authenticated` (state
  mismatch vs. exchange failure vs. no session) — the page shows one
  generic message, matching the existing `fail()` behavior of converging
  all failure modes to a single redirect.
