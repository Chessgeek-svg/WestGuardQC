import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import * as client from './api/client'

vi.mock('./api/client')

describe('App', () => {
  beforeEach(() => {
    vi.mocked(client.listAnalytes).mockResolvedValue([])
    vi.mocked(client.listLots).mockResolvedValue([])
  })

  it('renders the product name and a lot selector', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /westguardqc/i })).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: /qc lot/i })).toBeInTheDocument()
  })

  it('prompts to select a lot before one is chosen', async () => {
    render(<App />)
    expect(screen.getByText(/select a lot to view/i)).toBeInTheDocument()
    // Let the selector's async load settle so no state update escapes act().
    await screen.findByRole('combobox', { name: /qc lot/i })
  })
})
