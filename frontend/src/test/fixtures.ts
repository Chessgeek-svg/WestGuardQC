import type { LotResults, QCResult } from '../api/types'

export function makeResult(overrides: Partial<QCResult> = {}): QCResult {
  return {
    id: 1,
    qc_lot_id: 1,
    value: 100,
    recorded_at: '2026-07-08T08:00:00Z',
    recorded_by: 'tech1',
    accepted: true,
    westgard_violations: [],
    voided_at: null,
    voided_by: null,
    void_reason: null,
    status: 'in_control',
    created_at: '2026-07-08T08:00:00Z',
    updated_at: '2026-07-08T08:00:00Z',
    ...overrides,
  }
}

/** A result withdrawn from evaluation, keeping the verdict it had at the time. */
export function makeVoided(overrides: Partial<QCResult> = {}): QCResult {
  return makeResult({
    voided_at: '2026-07-09T10:00:00Z',
    voided_by: 'supervisor',
    void_reason: 'transcription error',
    status: 'voided',
    ...overrides,
  })
}

export function makeBundle(overrides: Partial<LotResults> = {}): LotResults {
  return {
    lot_id: 1,
    lot_number: 'GLU-1042',
    analyte_name: 'Glucose',
    unit: 'mg/dL',
    level: 'Level 1',
    target_mean: 100,
    target_sd: 5,
    expiration_date: '2027-01-01',
    active: true,
    results: [],
    ...overrides,
  }
}
