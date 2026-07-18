import { describe, expect, it } from 'vitest'

import { makeResult } from '../test/fixtures'
import { observedStats } from './stats'

describe('observedStats', () => {
  it('returns nulls for an empty set', () => {
    const stats = observedStats([])
    expect(stats).toEqual({
      n: 0,
      mean: null,
      sd: null,
      cv: null,
      last10Average: null,
      latestStatus: null,
    })
  })

  it('computes mean, sample SD, CV, last-10 average, and latest status', () => {
    const stats = observedStats([
      makeResult({ id: 1, value: 100, recorded_at: '2026-07-08T08:00:00Z' }),
      makeResult({ id: 2, value: 110, recorded_at: '2026-07-08T09:00:00Z' }),
      makeResult({
        id: 3,
        value: 90,
        recorded_at: '2026-07-08T10:00:00Z',
        status: 'rejected',
      }),
    ])
    expect(stats.n).toBe(3)
    expect(stats.mean).toBeCloseTo(100)
    expect(stats.sd).toBeCloseTo(10) // sample SD: sqrt(200 / 2)
    expect(stats.cv).toBeCloseTo(10)
    expect(stats.last10Average).toBeCloseTo(100)
    expect(stats.latestStatus).toBe('rejected')
  })

  it('leaves SD and CV null with a single point', () => {
    const stats = observedStats([makeResult({ value: 100 })])
    expect(stats.n).toBe(1)
    expect(stats.sd).toBeNull()
    expect(stats.cv).toBeNull()
  })
})
