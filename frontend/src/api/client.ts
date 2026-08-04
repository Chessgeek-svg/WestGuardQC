import type {
  Analyte,
  AnalyteCreate,
  LotResults,
  QCLot,
  QCLotCreate,
  QCLotUpdate,
  QCResult,
  QCResultCreate,
  QCResultVoid,
} from './types'

const BASE_URL = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail = response.statusText
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') {
      detail = body.detail
    } else if (Array.isArray(body.detail)) {
      // FastAPI validation errors are a list of {loc, msg, ...}.
      detail = body.detail
        .map((item) => (item as { msg?: string }).msg ?? 'invalid input')
        .join('; ')
    }
  } catch {
    // Response had no JSON body; fall back to the status text.
  }
  return new ApiError(response.status, detail)
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`)
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}

async function apiSend<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}

function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>('POST', path, body)
}

export function getLotResults(lotId: number, limit = 50): Promise<LotResults> {
  return apiGet<LotResults>(`/api/v1/qc-lots/${lotId}/results?limit=${limit}`)
}

export function getDashboard(analyteId?: number, limit = 30): Promise<LotResults[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (analyteId !== undefined) params.set('analyte_id', String(analyteId))
  return apiGet<LotResults[]>(`/api/v1/dashboard?${params.toString()}`)
}

export function createResult(payload: QCResultCreate): Promise<QCResult> {
  return apiPost<QCResult>('/api/v1/qc-results', payload)
}

/** Withdraw a result from evaluation. The row survives; the verdicts of the
 *  results after it are recomputed server-side without it. */
export function voidResult(resultId: number, payload: QCResultVoid): Promise<QCResult> {
  return apiPost<QCResult>(`/api/v1/qc-results/${resultId}/void`, payload)
}

export function updateLot(lotId: number, payload: QCLotUpdate): Promise<QCLot> {
  return apiSend<QCLot>('PATCH', `/api/v1/qc-lots/${lotId}`, payload)
}

export function listAnalytes(): Promise<Analyte[]> {
  return apiGet<Analyte[]>('/api/v1/analytes')
}

export function createAnalyte(payload: AnalyteCreate): Promise<Analyte> {
  return apiPost<Analyte>('/api/v1/analytes', payload)
}

/** Lots, optionally filtered by state. The dashboard only ever shows active
 *  lots, so `active: false` is how a retired lot is found again. */
export function listLots(active?: boolean): Promise<QCLot[]> {
  const query = active === undefined ? '' : `?active=${String(active)}`
  return apiGet<QCLot[]>(`/api/v1/qc-lots${query}`)
}

export function createLot(payload: QCLotCreate): Promise<QCLot> {
  return apiPost<QCLot>('/api/v1/qc-lots', payload)
}
