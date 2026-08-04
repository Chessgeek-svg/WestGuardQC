import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import * as client from './api/client'

vi.mock('./api/client')

describe('App', () => {
  beforeEach(() => {
    vi.mocked(client.getDashboard).mockResolvedValue([])
    vi.mocked(client.listLots).mockResolvedValue([])
  })

  it('renders the header and the dashboard route', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /westguardqc/i })).toBeInTheDocument()
    expect(await screen.findByText(/no active lots/i)).toBeInTheDocument()
  })
})
