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
