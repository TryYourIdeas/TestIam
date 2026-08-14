# Auth Pages Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the combined authenticated/login page into dedicated `/`, `/authenticated`, `/not-authenticated`, and `/dashboard` routes, extract testable presentational components, and add vitest + testing-library unit test coverage for them.

**Architecture:** Server middleware keeps doing only the OAuth code/state exchange (unconditionally, regardless of path) and redirects to `/authenticated` on success or `/not-authenticated` on failure. Each protected page (`/`, `/authenticated`, `/dashboard`) checks its own session via `useAuth().fetchSession()` and redirects client/SSR-side as needed — no more per-path guarding in middleware. New presentational components (`AuthActions`, `DashboardCard`, `NotAuthenticatedNotice`) hold the actual markup/interaction and get unit tests; pages stay thin data-fetching + redirect wrappers (unches, matching the sibling `iam` project's convention of testing components/composables, not pages).

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, h3 (existing). New: Vitest, `@nuxt/test-utils`, `@testing-library/vue`, `@testing-library/user-event`, `@vue/test-utils`, `happy-dom` — versions mirrored from the sibling `iam` project's `package.json`, which uses the same Nuxt major version.

Full context: `docs/superpowers/specs/2026-08-13-auth-pages-refactor-design.md`

---

### Task 1: Test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `test/setup.ts`

- [ ] **Step 1: Add test dependencies and script to `package.json`**

Replace the `scripts` and `devDependencies` blocks:

```json
{
  "name": "testiam",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "typecheck": "nuxi typecheck",
    "test": "vitest run",
    "postinstall": "nuxt prepare"
  },
  "dependencies": {
    "nuxt": "^4.5.2",
    "vue": "^3.5.40"
  },
  "devDependencies": {
    "@nuxt/test-utils": "^4.1.0",
    "@testing-library/user-event": "^14.6.3",
    "@testing-library/vue": "^8.1.0",
    "@types/node": "^26.1.2",
    "@vue/test-utils": "^2.4.11",
    "happy-dom": "^20.11.1",
    "typescript": "^5.9.3",
    "vitest": "^4.1.10",
    "vue-tsc": "^3.3.9"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes with no errors; `package-lock.json` updated.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    setupFiles: ['./test/setup.ts'],
  },
})
```

- [ ] **Step 4: Create `test/setup.ts`**

```ts
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/vue'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 5: Verify the harness runs with zero tests**

Run: `npm test`
Expected: vitest starts, reports "No test files found" (or passes with 0 tests) — proves config/setup load without error before any real test is added.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts test/setup.ts
git commit -m "config: add vitest and testing-library test infrastructure"
```

---

### Task 2: `useAuth` composable — logout redirects to `/`

**Files:**
- Modify: `composables/useAuth.ts`
- Create: `composables/useAuth.test.ts`

- [ ] **Step 1: Write the failing test**

`composables/useAuth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAuth } from './useAuth'

const { fetchMock, requestFetchMock, navigateToMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  requestFetchMock: vi.fn(),
  navigateToMock: vi.fn(),
}))

mockNuxtImport('$fetch', () => fetchMock)
mockNuxtImport('useRequestFetch', () => () => requestFetchMock)
mockNuxtImport('navigateTo', () => navigateToMock)

describe('useAuth', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    requestFetchMock.mockReset()
    navigateToMock.mockReset()
  })

  it('fetchSession stores the session user via useRequestFetch', async () => {
    requestFetchMock.mockResolvedValueOnce({ user: { username: 'alice', email: 'alice@example.com' } })
    const auth = useAuth()

    const result = await auth.fetchSession()

    expect(requestFetchMock).toHaveBeenCalledWith('/api/auth/session')
    expect(result).toEqual({ username: 'alice', email: 'alice@example.com' })
    expect(auth.user.value).toEqual({ username: 'alice', email: 'alice@example.com' })
    expect(auth.status.value).toBe('authenticated')
  })

  it('logout clears the session and redirects to /', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const auth = useAuth()
    auth.user.value = { username: 'alice', email: 'alice@example.com' }

    await auth.logout()

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    expect(auth.user.value).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `npx vitest run composables/useAuth.test.ts`
Expected: the `fetchSession` test PASSES (behavior already correct from the earlier SSR-cookie fix); the `logout` test FAILS because `logout()` still calls `navigateTo(useRuntimeConfig().public.auth.loginPath)`, and `useRuntimeConfig` isn't mocked/available in this shape — it will either throw or call `navigateToMock` with an unexpected argument. Confirm the failure message references the logout assertion, not fetchSession.

- [ ] **Step 3: Update `logout()` in `composables/useAuth.ts`**

Change:

```ts
  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo(useRuntimeConfig().public.auth.loginPath)
  }
```

to:

```ts
  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/')
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run composables/useAuth.test.ts`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add composables/useAuth.ts composables/useAuth.test.ts
git commit -m "bugfix: redirect to / after logout instead of the removed login page"
```

---

### Task 3: `AuthActions` component (Login/Register buttons)

**Files:**
- Create: `components/AuthActions.vue`
- Test: `components/AuthActions.test.ts`

- [ ] **Step 1: Write the failing test**

`components/AuthActions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import AuthActions from './AuthActions.vue'

describe('AuthActions', () => {
  it('renders a Login link to the login endpoint', () => {
    render(AuthActions)

    const link = screen.getByRole('link', { name: 'Login' })
    expect(link.getAttribute('href')).toBe('/api/auth/login')
  })

  it('renders a Register link to the same login endpoint', () => {
    render(AuthActions)

    const link = screen.getByRole('link', { name: 'Register' })
    expect(link.getAttribute('href')).toBe('/api/auth/login')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/AuthActions.test.ts`
Expected: FAIL — `Failed to resolve import "./AuthActions.vue"` (file doesn't exist yet).

- [ ] **Step 3: Create `components/AuthActions.vue`**

```vue
<template>
  <div class="actions">
    <a class="btn" href="/api/auth/login">Login</a>
    <a class="btn" href="/api/auth/login">Register</a>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 12px;
}

.btn {
  font-family: var(--mono);
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  text-decoration: none;
  transition: border-color 0.3s;
}

.btn:hover {
  border-color: var(--accent-border);
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/AuthActions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/AuthActions.vue components/AuthActions.test.ts
git commit -m "feat: add AuthActions component with Login/Register buttons"
```

---

### Task 4: `DashboardCard` component (user info + logout button)

**Files:**
- Create: `components/DashboardCard.vue`
- Test: `components/DashboardCard.test.ts`

- [ ] **Step 1: Write the failing test**

`components/DashboardCard.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import DashboardCard from './DashboardCard.vue'

describe('DashboardCard', () => {
  it('renders the signed-in user email and username', () => {
    render(DashboardCard, { props: { user: { username: 'alice', email: 'alice@example.com' } } })

    expect(screen.getByText('alice@example.com')).toBeTruthy()
    expect(screen.getByText('subject: alice')).toBeTruthy()
  })

  it('emits logout when the button is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = render(DashboardCard, {
      props: { user: { username: 'alice', email: 'alice@example.com' } },
    })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(emitted().logout).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/DashboardCard.test.ts`
Expected: FAIL — `Failed to resolve import "./DashboardCard.vue"`.

- [ ] **Step 3: Create `components/DashboardCard.vue`**

```vue
<script setup lang="ts">
defineProps<{ user: { username: string; email: string } }>()
defineEmits<{ logout: [] }>()
</script>

<template>
  <div class="card">
    <p>Signed in as <strong>{{ user.email }}</strong></p>
    <p class="muted">subject: {{ user.username }}</p>
    <button type="button" class="btn" @click="$emit('logout')">Log out</button>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.muted {
  color: var(--text);
  font-size: 14px;
}

.btn {
  font-family: var(--mono);
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.3s;
}

.btn:hover {
  border-color: var(--accent-border);
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/DashboardCard.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/DashboardCard.vue components/DashboardCard.test.ts
git commit -m "feat: add DashboardCard component showing user data and logout button"
```

---

### Task 5: `NotAuthenticatedNotice` component

**Files:**
- Create: `components/NotAuthenticatedNotice.vue`
- Test: `components/NotAuthenticatedNotice.test.ts`

- [ ] **Step 1: Write the failing test**

`components/NotAuthenticatedNotice.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import NotAuthenticatedNotice from './NotAuthenticatedNotice.vue'

describe('NotAuthenticatedNotice', () => {
  it('shows the "No authenticated" message', () => {
    render(NotAuthenticatedNotice)

    expect(screen.getByText('No authenticated')).toBeTruthy()
  })

  it('renders a "Go home" link to /', () => {
    render(NotAuthenticatedNotice)

    const link = screen.getByRole('link', { name: 'Go home' })
    expect(link.getAttribute('href')).toBe('/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/NotAuthenticatedNotice.test.ts`
Expected: FAIL — `Failed to resolve import "./NotAuthenticatedNotice.vue"`.

- [ ] **Step 3: Create `components/NotAuthenticatedNotice.vue`**

```vue
<template>
  <div class="notice">
    <p class="error">No authenticated</p>
    <a class="btn" href="/">Go home</a>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.error {
  color: var(--text-h);
  background: var(--code-bg);
  padding: 6px 12px;
  border-radius: 6px;
}

.btn {
  font-family: var(--mono);
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  text-decoration: none;
  transition: border-color 0.3s;
}

.btn:hover {
  border-color: var(--accent-border);
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/NotAuthenticatedNotice.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/NotAuthenticatedNotice.vue components/NotAuthenticatedNotice.test.ts
git commit -m "feat: add NotAuthenticatedNotice component"
```

---

### Task 6: Rewrite `pages/index.vue` as the landing page

**Files:**
- Modify: `pages/index.vue`

- [ ] **Step 1: Replace the file contents**

```vue
<script setup lang="ts">
const { fetchSession } = useAuth()

const { data: user } = await useAsyncData('auth-session', () => fetchSession())

if (user.value) {
  await navigateTo('/dashboard')
}
</script>

<template>
  <div v-if="!user" class="page">
    <h1>testiam</h1>
    <AuthActions />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 48px 24px;
}
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (auto-imports for `AuthActions`, `useAuth`, `useAsyncData`, `navigateTo` all resolve).

- [ ] **Step 3: Commit**

```bash
git add pages/index.vue
git commit -m "feat: turn / into a landing page with Login/Register buttons"
```

---

### Task 7: `pages/authenticated.vue` (OAuth landing page)

**Files:**
- Create: `pages/authenticated.vue`

- [ ] **Step 1: Create the file**

```vue
<script setup lang="ts">
const { fetchSession } = useAuth()

const { data: user } = await useAsyncData('auth-session', () => fetchSession())

await navigateTo(user.value ? '/dashboard' : '/not-authenticated')
</script>

<template>
  <div class="page">
    <p>Redirecting…</p>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 48px 24px;
}
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add pages/authenticated.vue
git commit -m "feat: add /authenticated OAuth landing page"
```

---

### Task 8: `pages/not-authenticated.vue`

**Files:**
- Create: `pages/not-authenticated.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <div class="page">
    <h1>Sign in</h1>
    <NotAuthenticatedNotice />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 48px 24px;
}
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add pages/not-authenticated.vue
git commit -m "feat: add /not-authenticated page"
```

---

### Task 9: `pages/dashboard.vue`

**Files:**
- Create: `pages/dashboard.vue`

- [ ] **Step 1: Create the file**

```vue
<script setup lang="ts">
const { fetchSession, logout } = useAuth()

const { data: user } = await useAsyncData('auth-session', () => fetchSession())

if (!user.value) {
  await navigateTo('/not-authenticated')
}
</script>

<template>
  <div v-if="user" class="page">
    <h1>Dashboard</h1>
    <DashboardCard :user="user" @logout="logout" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 48px 24px;
}
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add pages/dashboard.vue
git commit -m "feat: add /dashboard page"
```

---

### Task 10: Remove `pages/login.vue`

**Files:**
- Delete: `pages/login.vue`

- [ ] **Step 1: Delete the file**

Run: `git rm pages/login.vue`

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (nothing references `/login` anymore after Task 2 and Task 11).

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove pages/login.vue, superseded by / and /not-authenticated"
```

---

### Task 11: Simplify `server/middleware/auth.ts`

**Files:**
- Modify: `server/middleware/auth.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import type { H3Event } from 'h3'
import { getRequestURL, sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (code || state) {
    if (!code || !state) {
      return sendRedirect(event, '/not-authenticated')
    }
    return handleAuthCallback(event, code, state)
  }
})

async function handleAuthCallback(event: H3Event, code: string, state: string) {
  const config = useRuntimeConfig(event)
  const url = getRequestURL(event)

  const fail = () => sendRedirect(event, '/not-authenticated')

  const attempt = getAuthAttempt(event)
  if (!attempt) return fail()
  if (state !== attempt.state) return fail()

  let tokens: TokenResponse
  try {
    tokens = await exchangeCode(event, code)
  } catch {
    return fail()
  }

  if (!tokens.id_token) return fail()

  let idClaims: IdClaims
  try {
    idClaims = decodeJwtPayload(tokens.id_token) as unknown as IdClaims
  } catch {
    return fail()
  }

  if (idClaims.nonce !== attempt.nonce) return fail()
  if (!audienceMatches(idClaims.aud, config.iam.appId)) return fail()
  if (Date.now() >= idClaims.exp * 1000) return fail()

  await createIamSession(event, {
    username: idClaims.sub,
    email: tokens.user_email,
    accessToken: tokens.token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
  })

  clearAuthAttempt(event)

  return sendRedirect(event, url.pathname)
}
```

This removes the `event.path`/`config.auth.authenticatedPath` per-path guard block entirely — `/authenticated` and `/dashboard` now guard themselves client/SSR-side via `useAuth().fetchSession()` (Tasks 7 and 9), and `fail()` now redirects to the dedicated `/not-authenticated` page instead of `/login?error=...`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/middleware/auth.ts
git commit -m "refactor: simplify auth middleware to only handle the OAuth exchange"
```

---

### Task 12: Update `server/api/auth/login.get.ts` redirect target

**Files:**
- Modify: `server/api/auth/login.get.ts`

- [ ] **Step 1: Change the already-authenticated redirect**

Change:

```ts
  const session = await getIamSession(event)
  if (session) {
    return sendRedirect(event, config.auth.authenticatedPath)
  }
```

to:

```ts
  const session = await getIamSession(event)
  if (session) {
    return sendRedirect(event, '/dashboard')
  }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/api/auth/login.get.ts
git commit -m "refactor: skip /authenticated hop, go straight to /dashboard for existing sessions"
```

---

### Task 13: Update `nuxt.config.ts`

**Files:**
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Update `runtimeConfig`**

Replace:

```ts
  runtimeConfig: {
    // Server-only secrets (never exposed to the client)
    iam: {
      url: '',
      appId: '',
      clientSecret: '',
    },
    auth: {
      // The app URL IAM redirects back to with ?code=&state=
      authenticatedPath: '/',
    },
    public: {
      auth: {
        loginPath: '/login',
      },
    },
  },
```

with:

```ts
  runtimeConfig: {
    // Server-only secrets (never exposed to the client)
    iam: {
      url: '',
      appId: '',
      clientSecret: '',
    },
    auth: {
      // The path IAM redirects back to with ?code=&state= — must exactly
      // match this app's registered authenticated_url on iam.
      authenticatedPath: '/authenticated',
    },
  },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add nuxt.config.ts
git commit -m "config: point authenticatedPath at /authenticated, drop unused public.auth"
```

---

### Task 14: Update `.env` and `.env.example`

**Files:**
- Modify: `.env.example`
- Modify: `.env` (not committed — gitignored)

- [ ] **Step 1: Update `.env.example`**

```ini
# IAM SSO client configuration
# Copy to .env and fill in the values obtained from iam's admin dashboard
# (https://iam.tryyourideas.com/admin — see iam/CONFIG.md, "Registering SSO
# client applications").
NUXT_IAM_URL=https://iam.tryyourideas.com
NUXT_IAM_APP_ID=test
NUXT_IAM_CLIENT_SECRET=b8c5003f-4045-489e-af47-e7bf9b5eca43

# The app path IAM redirects back to with ?code=&state= — must exactly
# match this app's registered authenticated_url on iam.
NUXT_AUTH_AUTHENTICATED_PATH=/authenticated
```

- [ ] **Step 2: Update `.env`**

Same edit as Step 1, but keep the real `NUXT_IAM_APP_ID`/`NUXT_IAM_CLIENT_SECRET` values already in the file — only change `NUXT_AUTH_AUTHENTICATED_PATH` to `/authenticated` and remove the `NUXT_PUBLIC_AUTH_LOGIN_PATH` line.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example for /authenticated path and retired register-app script"
```

(`.env` itself is gitignored — nothing to commit there, just confirm `git status` doesn't show it.)

---

### Task 15: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the "Setup" and "Auth flow" sections**

Replace the whole file with:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for the new auth pages and test command"
```

---

### Task 16: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "Commands" section**

Add a `npm test` line after `npm run typecheck`:

```markdown
npm run typecheck     # nuxi typecheck (vue-tsc)
npm test              # vitest unit tests (components + composables)
```

Update the sentence below the command block from "No test suite or lint script is configured in `package.json`." to:

```markdown
No lint script is configured in `package.json`. Unit tests use Vitest with `@nuxt/test-utils`'s `environment: 'nuxt'` and `@testing-library/vue`, mirroring the sibling `iam` project's setup — see `vitest.config.ts` and `test/setup.ts`. Convention: test presentational components (`components/`) and composables directly; pages stay thin data-fetching/redirect wrappers and aren't unit-tested directly (same convention `iam` uses).
```

- [ ] **Step 2: Update the "Architecture" section**

Replace the existing architecture paragraph (the one starting "The authenticated page and the OAuth callback are the same route...") with:

```markdown
The OAuth callback and the various auth states each have their own dedicated page — no route does double duty:

- **`server/middleware/auth.ts`** runs on every request and *only* handles the OAuth exchange: if `?code=&state=` are present (`handleAuthCallback`), it validates the stored `state`/`nonce` attempt cookie, exchanges the code via `exchangeCode`, decodes and checks the `id_token` (`nonce`/`aud`/`exp`), creates a session, then redirects to `/authenticated` stripped of the query string. Any validation failure redirects to `/not-authenticated`. It does no per-path session guarding — that's each page's own job.
- **`server/utils/auth.ts`** holds the stateless helpers and the session store: attempt generation/cookie (`iam_attempt`), the `POST /token` calls for both `authorization_code` and `refresh_token` grants, JWT payload decoding (decode-only — no signature verification, see Phase 1 gaps), and session CRUD backed by Nitro's `useStorage('iam:sessions')` (in-memory — sessions do not survive a server restart) with the `iam_session` cookie holding the session id. `getIamSession` transparently refreshes an expired access token (rotating the refresh token) or destroys the session if refresh fails.
- **`server/api/auth/login.get.ts`** — starts a fresh attempt and redirects to `iam`'s `GET /auth`, or redirects straight to `/dashboard` if a session already exists.
- **`server/api/auth/logout.post.ts`** / **`server/api/auth/session.get.ts`** — destroy/read the local session. Logout is local-only; it does not touch `iam`'s own session or revoke the refresh token there.
- **`composables/useAuth.ts`** — client-side wrapper (`useState('auth-user')`) around `/api/auth/session` and `/api/auth/logout`. `fetchSession()` uses `useRequestFetch()` rather than the global `$fetch` — this matters during SSR, since `$fetch` does not forward the incoming request's cookies to internal API calls, which previously caused pages to render as logged-out even with a valid session.
- **Pages self-guard using `useAuth().fetchSession()`**: `pages/index.vue` redirects to `/dashboard` if already signed in, otherwise renders `AuthActions`. `pages/authenticated.vue` (the registered `authenticated_url`) redirects to `/dashboard` or `/not-authenticated` depending on session state. `pages/dashboard.vue` redirects to `/not-authenticated` if no session, otherwise renders `DashboardCard`. `pages/not-authenticated.vue` renders `NotAuthenticatedNotice` unconditionally.

When changing any validation step (state/nonce/aud/exp checks, cookie flags, refresh rotation), keep `server/middleware/auth.ts` and `server/utils/auth.ts` in sync with the corresponding checklist item in `IAM_CLIENT_IMPLEMENTATION.md`, and update that doc if behavior intentionally diverges from it.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md architecture section for the auth pages refactor"
```

---

### Task 17: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (composable + 3 component test files).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end smoke test with a mock session**

This mirrors the technique already used earlier in this project to catch the SSR-cookie bug: a temporary debug route that mints a real session, so the full page chain can be exercised without a live `iam` round-trip.

Create a temporary file `server/api/debug/mock-session.get.ts`:

```ts
export default defineEventHandler(async (event) => {
  await createIamSession(event, {
    username: 'debug-user',
    email: 'debug@example.com',
    accessToken: 'debug-access',
    refreshToken: 'debug-refresh',
    accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
  })
  return { ok: true }
})
```

Run:

```bash
npm run dev &
sleep 3
curl -s -c /tmp/cookies.txt http://localhost:3000/api/debug/mock-session
# / with a valid session should redirect straight to /dashboard and show the email
curl -s -b /tmp/cookies.txt http://localhost:3000/ | grep -o -E "Login|debug@example.com"
# /authenticated with a valid session should also land on /dashboard content
curl -s -b /tmp/cookies.txt http://localhost:3000/authenticated | grep -o -E "Redirecting|debug@example.com"
# / with no session should show the Login/Register buttons
curl -s http://localhost:3000/ | grep -o -E "Login|Register"
# /dashboard with no session should redirect to /not-authenticated
curl -s http://localhost:3000/dashboard | grep -o -E "No authenticated|Go home"
kill %1
```

Expected: the authenticated requests show `debug@example.com`; the unauthenticated `/` request shows `Login`/`Register`; the unauthenticated `/dashboard` request shows `No authenticated`/`Go home`.

- [ ] **Step 4: Remove the temporary debug route**

```bash
rm server/api/debug/mock-session.get.ts
rmdir server/api/debug 2>/dev/null || true
git status
```

Expected: `git status` shows no trace of the debug route (it was never committed).

- [ ] **Step 5: Final commit if anything was left uncommitted**

```bash
git status
```

If clean, nothing to do — every task already committed its own changes.

---

## Manual follow-up (not part of this plan)

Once deployed, confirm with a real `iam` login that the full redirect chain (`/` → `iam` → `/authenticated` → `/dashboard`) works end-to-end, since Task 17's verification uses a mocked session rather than a live `iam` round-trip.
