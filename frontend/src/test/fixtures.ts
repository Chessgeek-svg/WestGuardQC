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
    status: 'in_control',
    created_at: '2026-07-08T08:00:00Z',
    updated_at: '2026-07-08T08:00:00Z',
    ...overrides,
  }
}

export function makeBundle(overrides: Partial<LotResults> = {}): LotResults {
  return {
    lot_id: 1,
    analyte_name: 'Glucose',
    unit: 'mg/dL',
    level: 'Level 1',
    target_mean: 100,
    target_sd: 5,
    results: [],
    ...overrides,
  }
}
