import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, createResult, listLots } from './client'

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listLots', () => {
  it('requests active lots and returns the parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }]))
    vi.stubGlobal('fetch', fetchMock)

    const lots = await listLots({ activeOnly: true })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/qc-lots?active=true')
    expect(lots).toEqual([{ id: 1 }])
  })
})

describe('createResult', () => {
  it('POSTs JSON to the results endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 5, status: 'rejected' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createResult({ qc_lot_id: 1, value: 116, recorded_by: 'tech1' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/qc-results')
    expect(init.method).toBe('POST')
    expect(result.status).toBe('rejected')
  })
})

describe('error handling', () => {
  it('throws ApiError with the FastAPI string detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ detail: 'QC lot not found' }, { ok: false, status: 404 }),
        ),
    )

    await expect(listLots()).rejects.toMatchObject({ status: 404, message: 'QC lot not found' })
  })

  it('joins FastAPI validation error lists into one message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { detail: [{ msg: 'field required' }, { msg: 'too small' }] },
            { ok: false, status: 422 },
          ),
        ),
    )

    const error = await listLots().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('field required; too small')
  })
})
