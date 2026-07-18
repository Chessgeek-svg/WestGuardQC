import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeBundle, makeResult } from '../test/fixtures'
import { StatsSummary } from './StatsSummary'

describe('StatsSummary', () => {
  it('shows "No data" and N=0 for a lot with no results', () => {
    render(<StatsSummary data={makeBundle()} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('N = 0')).toBeInTheDocument()
  })

  it('shows observed values against the target', () => {
    const data = makeBundle({
      target_mean: 100,
      target_sd: 5,
      results: [makeResult({ id: 1, value: 100 }), makeResult({ id: 2, value: 110 })],
    })
    render(<StatsSummary data={data} />)
    expect(screen.getByText('N = 2')).toBeInTheDocument()
    // Observed mean 105 rendered (also equals the last-10 average here),
    // shown against the target 100.
    expect(screen.getAllByText(/105\.0/).length).toBeGreaterThan(0)
    expect(screen.getByText(/\/ 100/)).toBeInTheDocument()
  })
})
