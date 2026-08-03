import { render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { makeBundle, makeResult, makeVoided } from '../test/fixtures'
import { LotTrackerCard } from './LotTrackerCard'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>
    }) => cloneElement(children, { width: 400, height: 160 }),
  }
})

describe('LotTrackerCard', () => {
  it('links to the lot detail and shows the analyte and stats', () => {
    const data = makeBundle({
      lot_id: 7,
      results: [
        makeResult({ id: 1, value: 100, recorded_at: '2026-07-08T08:00:00Z' }),
        makeResult({ id: 2, value: 110, recorded_at: '2026-07-08T09:00:00Z' }),
      ],
    })
    render(
      <MemoryRouter>
        <LotTrackerCard data={data} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/lots/7')
    expect(screen.getByText(/glucose/i)).toBeInTheDocument()
    expect(screen.getByText('N = 2')).toBeInTheDocument()
  })

  it('shows a placeholder when the lot has no results', () => {
    render(
      <MemoryRouter>
        <LotTrackerCard data={makeBundle()} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no results yet/i)).toBeInTheDocument()
  })

  it('shows the lot number, so two lots of the same level are distinguishable', () => {
    render(
      <MemoryRouter>
        <LotTrackerCard data={makeBundle({ lot_number: 'GLU-2311' })} />
      </MemoryRouter>,
    )
    expect(screen.getByText('GLU-2311')).toBeInTheDocument()
  })

  it('badges a lot past its expiration date', () => {
    const { rerender } = render(
      <MemoryRouter>
        <LotTrackerCard data={makeBundle({ expiration_date: '2099-01-01' })} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <LotTrackerCard data={makeBundle({ expiration_date: '2020-01-01' })} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/expired/i)).toBeInTheDocument()
  })

  it('treats an all-voided lot as having nothing to plot', () => {
    render(
      <MemoryRouter>
        <LotTrackerCard data={makeBundle({ results: [makeVoided({ id: 1 })] })} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no results yet/i)).toBeInTheDocument()
  })
})
