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
