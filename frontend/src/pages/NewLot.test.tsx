import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as client from '../api/client'
import { makeAnalyte, makeLot } from '../test/fixtures'
import { NewLot } from './NewLot'

vi.mock('../api/client')

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

/** Everything except the analyte, which each test picks differently. */
function fillLotFields() {
  fill(/lot number/i, 'GLU-9001')
  fill(/^level$/i, 'Level 2')
  fill(/manufacturer/i, 'BioRad')
  fill(/target mean/i, '250')
  fill(/target sd/i, '7.5')
  fill(/expiration date/i, '2027-06-30')
}

describe('NewLot', () => {
  beforeEach(() => {
    vi.mocked(client.listAnalytes).mockResolvedValue([makeAnalyte({ id: 3, name: 'Glucose' })])
    vi.mocked(client.createLot).mockResolvedValue(makeLot({ id: 42 }))
    vi.mocked(client.createAnalyte).mockResolvedValue(makeAnalyte({ id: 7, name: 'Potassium' }))
  })

  it('creates a lot against an existing analyte', async () => {
    render(
      <MemoryRouter>
        <NewLot />
      </MemoryRouter>,
    )
    await screen.findByRole('option', { name: /glucose/i })
    fillLotFields()
    fireEvent.click(screen.getByRole('button', { name: /create lot/i }))

    await waitFor(() => {
      expect(client.createLot).toHaveBeenCalledWith({
        analyte_id: 3,
        lot_number: 'GLU-9001',
        manufacturer: 'BioRad',
        level: 'Level 2',
        target_mean: 250,
        target_sd: 7.5,
        expiration_date: '2027-06-30',
      })
    })
    expect(client.createAnalyte).not.toHaveBeenCalled()
  })

  it('creates the analyte first when a new one is chosen', async () => {
    render(
      <MemoryRouter>
        <NewLot />
      </MemoryRouter>,
    )
    await screen.findByRole('option', { name: /glucose/i })
    fireEvent.change(screen.getByLabelText(/^analyte$/i), { target: { value: 'new' } })
    fill(/analyte name/i, 'Potassium')
    fill(/unit/i, 'mmol/L')
    fillLotFields()
    fireEvent.click(screen.getByRole('button', { name: /create lot/i }))

    await waitFor(() => {
      expect(client.createAnalyte).toHaveBeenCalledWith({ name: 'Potassium', unit: 'mmol/L' })
    })
    // The lot has to point at the analyte that was just created.
    expect(client.createLot).toHaveBeenCalledWith(expect.objectContaining({ analyte_id: 7 }))
  })

  it('reports why the API refused', async () => {
    vi.mocked(client.createLot).mockRejectedValue(new Error('lot already exists'))
    render(
      <MemoryRouter>
        <NewLot />
      </MemoryRouter>,
    )
    await screen.findByRole('option', { name: /glucose/i })
    fillLotFields()
    fireEvent.click(screen.getByRole('button', { name: /create lot/i }))
    expect(await screen.findByText(/lot already exists/i)).toBeInTheDocument()
  })
})
