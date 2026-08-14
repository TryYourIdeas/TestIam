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
