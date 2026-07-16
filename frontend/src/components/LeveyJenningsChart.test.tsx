import { render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { LotResults } from '../api/types'
import { LeveyJenningsChart } from './LeveyJenningsChart'

// ResponsiveContainer renders nothing at 0x0 in jsdom, so give the inner chart
// a fixed size the way the real container does (by cloning in width/height).
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>
    }) => cloneElement(children, { width: 600, height: 400 }),
  }
})

const data: LotResults = {
  lot_id: 1,
  analyte_name: 'Glucose',
  unit: 'mg/dL',
  level: 'Level 1',
  target_mean: 100,
  target_sd: 5,
  results: [
    {
      id: 1,
      qc_lot_id: 1,
      value: 101,
      recorded_at: '2026-07-08T08:00:00Z',
      recorded_by: 'tech1',
      accepted: true,
      westgard_violations: [],
      status: 'in_control',
      created_at: '2026-07-08T08:00:00Z',
      updated_at: '2026-07-08T08:00:00Z',
    },
    {
      id: 2,
      qc_lot_id: 1,
      value: 116,
      recorded_at: '2026-07-08T09:00:00Z',
      recorded_by: 'tech1',
      accepted: false,
      westgard_violations: ['1-2s', '1-3s'],
      status: 'rejected',
      created_at: '2026-07-08T09:00:00Z',
      updated_at: '2026-07-08T09:00:00Z',
    },
  ],
}

describe('LeveyJenningsChart', () => {
  it('renders the lot header and target statistics', () => {
    render(<LeveyJenningsChart data={data} />)
    expect(screen.getByRole('heading', { name: /glucose/i })).toBeInTheDocument()
    expect(screen.getByText(/target 100 ± 5 mg\/dL/i)).toBeInTheDocument()
  })

  it('shows a status legend for the three verdicts', () => {
    render(<LeveyJenningsChart data={data} />)
    const legend = screen.getByRole('list', { name: /result status legend/i })
    expect(legend).toHaveTextContent('In control')
    expect(legend).toHaveTextContent('Warning')
    expect(legend).toHaveTextContent('Rejected')
  })

  it('draws the mean and SD reference lines', () => {
    render(<LeveyJenningsChart data={data} />)
    expect(screen.getByText('Mean')).toBeInTheDocument()
    expect(screen.getByText('+3SD')).toBeInTheDocument()
    expect(screen.getByText('-3SD')).toBeInTheDocument()
  })

  it('renders one status-colored point per result', () => {
    const { container } = render(<LeveyJenningsChart data={data} />)
    const dots = container.querySelectorAll('circle[fill^="var(--lj-status"]')
    expect(dots).toHaveLength(data.results.length)
  })
})
