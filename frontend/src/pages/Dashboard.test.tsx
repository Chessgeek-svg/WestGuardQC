import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as client from '../api/client'
import { makeBundle } from '../test/fixtures'
import { Dashboard } from './Dashboard'

vi.mock('../api/client')

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(client.getDashboard).mockResolvedValue([
      makeBundle({ lot_id: 1, analyte_name: 'Glucose' }),
      makeBundle({ lot_id: 2, analyte_name: 'Sodium' }),
    ])
  })

  it('renders a tracker card per active lot', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    const cards = await screen.findAllByRole('link')
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/lots/1', '/lots/2'])
  })

  it('filters the grid by analyte', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    await screen.findAllByRole('link')
    fireEvent.change(screen.getByRole('combobox', { name: /analyte/i }), {
      target: { value: 'Sodium' },
    })
    const cards = screen.getAllByRole('link')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('href', '/lots/2')
  })
})
