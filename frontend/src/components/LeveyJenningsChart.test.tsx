import { render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { makeBundle, makeResult } from '../test/fixtures'
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

const data = makeBundle({
  results: [
    makeResult({ id: 1, value: 101 }),
    makeResult({
      id: 2,
      value: 116,
      recorded_at: '2026-07-08T09:00:00Z',
      accepted: false,
      westgard_violations: ['1-2s', '1-3s'],
      status: 'rejected',
    }),
  ],
})

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
