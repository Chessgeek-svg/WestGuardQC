import { render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as client from '../api/client'
import { makeBundle, makeResult } from '../test/fixtures'
import { LotDetail } from './LotDetail'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>
    }) => cloneElement(children, { width: 600, height: 380 }),
  }
})

vi.mock('../api/client')

describe('LotDetail', () => {
  beforeEach(() => {
    vi.mocked(client.getLotResults).mockResolvedValue(
      makeBundle({
        lot_id: 1,
        results: [
          makeResult({
            id: 1,
            value: 116,
            status: 'rejected',
            westgard_violations: ['1-3s'],
          }),
        ],
      }),
    )
  })

  it('renders the chart, results table, and entry form for the routed lot', async () => {
    render(
      <MemoryRouter initialEntries={['/lots/1']}>
        <Routes>
          <Route path="/lots/:lotId" element={<LotDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: /glucose/i })).toBeInTheDocument()
    expect(screen.getByText(/recent results/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /record a result/i })).toBeInTheDocument()
    expect(screen.getByText('116')).toBeInTheDocument()
  })
})
