import { render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { makeBundle, makeResult } from '../test/fixtures'
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
})
