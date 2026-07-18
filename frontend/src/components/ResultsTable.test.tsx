import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeResult } from '../test/fixtures'
import { ResultsTable } from './ResultsTable'

describe('ResultsTable', () => {
  it('shows an empty state when there are no results', () => {
    render(<ResultsTable results={[]} />)
    expect(screen.getByText(/no results recorded/i)).toBeInTheDocument()
  })

  it('lists results newest-first with status and violations', () => {
    render(
      <ResultsTable
        results={[
          makeResult({ id: 1, value: 101, recorded_at: '2026-07-08T08:00:00Z' }),
          makeResult({
            id: 2,
            value: 116,
            recorded_at: '2026-07-08T09:00:00Z',
            status: 'rejected',
            westgard_violations: ['1-2s', '1-3s'],
          }),
        ]}
      />,
    )
    const rows = screen.getAllByRole('row').slice(1) // drop the header row
    expect(within(rows[0]).getByText('116')).toBeInTheDocument()
    expect(within(rows[0]).getByText('1-2s, 1-3s')).toBeInTheDocument()
    expect(within(rows[1]).getByText('101')).toBeInTheDocument()
  })
})
