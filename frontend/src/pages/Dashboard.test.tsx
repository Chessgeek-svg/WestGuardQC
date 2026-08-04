import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as client from '../api/client'
import { makeBundle, makeLot } from '../test/fixtures'
import { Dashboard } from './Dashboard'

vi.mock('../api/client')

/** Links to a specific lot, excluding "New lot" and the retired list. */
const lotCards = () =>
  screen.getAllByRole('link').filter((l) => /^\/lots\/\d+$/.test(l.getAttribute('href') ?? ''))

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(client.getDashboard).mockResolvedValue([
      makeBundle({ lot_id: 1, analyte_name: 'Glucose' }),
      makeBundle({ lot_id: 2, analyte_name: 'Sodium' }),
    ])
    vi.mocked(client.listLots).mockResolvedValue([])
  })

  it('renders a tracker card per active lot', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    await screen.findAllByRole('link')
    expect(lotCards().map((c) => c.getAttribute('href'))).toEqual(['/lots/1', '/lots/2'])
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
    const cards = lotCards()
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('href', '/lots/2')
  })

  it('offers a way to add a lot, including when there are none', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('link', { name: /new lot/i })).toHaveAttribute(
      'href',
      '/lots/new',
    )

    vi.mocked(client.getDashboard).mockResolvedValue([])
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    // An empty dashboard has to lead somewhere, or a fresh install dead-ends.
    expect(await screen.findByRole('link', { name: /add one/i })).toHaveAttribute(
      'href',
      '/lots/new',
    )
  })

  it('lists retired lots, which the grid never shows', async () => {
    vi.mocked(client.listLots).mockResolvedValue([
      makeLot({ id: 9, lot_number: 'NA-2211', level: 'Level 2', active: false }),
    ])
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /show retired lots \(1\)/i }))
    expect(screen.getByRole('link', { name: /NA-2211/ })).toHaveAttribute('href', '/lots/9')
  })
})
