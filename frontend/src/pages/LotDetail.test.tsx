import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/lots/1']}>
      <Routes>
        <Route path="/lots/:lotId" element={<LotDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LotDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    renderDetail()
    expect(await screen.findByRole('heading', { name: /glucose/i })).toBeInTheDocument()
    expect(screen.getByText(/recent results/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /record a result/i })).toBeInTheDocument()
    expect(screen.getByText('116')).toBeInTheDocument()
    expect(screen.getAllByText('GLU-1042').length).toBeGreaterThan(0)
  })

  it('voids a result with the reason given and reloads the lot', async () => {
    vi.mocked(client.voidResult).mockResolvedValue(makeResult({ id: 1 }))
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: /^void$/i }))
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'supervisor' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'wrong tube' } })
    fireEvent.click(screen.getByRole('button', { name: /void result/i }))

    await waitFor(() =>
      expect(client.voidResult).toHaveBeenCalledWith(1, {
        voided_by: 'supervisor',
        void_reason: 'wrong tube',
      }),
    )
    // Reloaded, so the recomputed verdicts of later results are picked up.
    expect(client.getLotResults).toHaveBeenCalledTimes(2)
  })

  it('retires the lot and then stops offering result entry', async () => {
    vi.mocked(client.updateLot).mockResolvedValue({} as never)
    vi.mocked(client.getLotResults)
      .mockResolvedValueOnce(makeBundle({ lot_id: 1, active: true }))
      .mockResolvedValueOnce(makeBundle({ lot_id: 1, active: false }))
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: /retire lot/i }))

    await waitFor(() => expect(client.updateLot).toHaveBeenCalledWith(1, { active: false }))
    expect(await screen.findByText(/retired/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /record a result/i })).not.toBeInTheDocument()
  })
})
