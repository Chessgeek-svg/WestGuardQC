import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { makeResult, makeVoided } from '../test/fixtures'
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

  it('shows a voided result struck through with who voided it and why', () => {
    render(
      <ResultsTable results={[makeVoided({ id: 1, value: 116, void_reason: 'wrong tube' })]} />,
    )
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('116')).toHaveClass('line-through')
    expect(within(row).getByText(/supervisor: wrong tube/i)).toBeInTheDocument()
    expect(within(row).getByText('Voided')).toBeInTheDocument()
  })

  it('offers a void action only for live results', () => {
    const onVoid = vi.fn()
    render(
      <ResultsTable
        results={[
          makeResult({ id: 1, value: 101, recorded_at: '2026-07-08T08:00:00Z' }),
          makeVoided({ id: 2, value: 116, recorded_at: '2026-07-08T09:00:00Z' }),
        ]}
        onVoid={onVoid}
      />,
    )
    const buttons = screen.getAllByRole('button', { name: /void/i })
    expect(buttons).toHaveLength(1)

    fireEvent.click(buttons[0])
    expect(onVoid).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })
})
