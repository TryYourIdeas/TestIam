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
