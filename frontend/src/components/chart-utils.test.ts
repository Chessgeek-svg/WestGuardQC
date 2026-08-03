import { describe, expect, it } from 'vitest'

import { makeResult as result, makeVoided } from '../test/fixtures'
import { referenceLines, statusColor, toChartPoints, yDomain, zScore } from './chart-utils'

describe('referenceLines', () => {
  it('returns the mean plus six SD boundaries', () => {
    const lines = referenceLines(100, 5)
    expect(lines).toHaveLength(7)
    expect(lines.find((l) => l.kind === 'mean')?.y).toBe(100)
    expect(lines.find((l) => l.label === '+2SD')?.y).toBe(110)
    expect(lines.find((l) => l.label === '-3SD')?.y).toBe(85)
  })
})

describe('statusColor', () => {
  it('maps each status to a distinct token', () => {
    const statuses = ['in_control', 'warning', 'rejected', 'pending', 'voided'] as const
    const colors = statuses.map(statusColor)
    expect(new Set(colors).size).toBe(statuses.length)
    expect(statusColor('rejected')).toContain('rejected')
  })
})

describe('toChartPoints', () => {
  it('maps results to epoch-timestamped points and defaults violations', () => {
    const points = toChartPoints([
      result({ value: 101, status: 'in_control' }),
      result({ value: 116, status: 'rejected', westgard_violations: null }),
    ])
    expect(points[0].t).toBe(new Date('2026-07-08T08:00:00Z').getTime())
    expect(points[0].value).toBe(101)
    expect(points[1].violations).toEqual([])
  })

  it('omits voided results, which no longer count', () => {
    const points = toChartPoints([
      result({ id: 1, value: 101 }),
      makeVoided({ id: 2, value: 150 }),
      result({ id: 3, value: 99 }),
    ])
    expect(points.map((p) => p.value)).toEqual([101, 99])
  })
})

describe('yDomain', () => {
  it('always spans at least the +/-3 SD lines', () => {
    const [low, high] = yDomain(100, 5, [101, 99])
    expect(low).toBeLessThan(85)
    expect(high).toBeGreaterThan(115)
  })

  it('expands to include outliers beyond 3 SD', () => {
    const [low, high] = yDomain(100, 5, [130])
    expect(high).toBeGreaterThanOrEqual(130)
    expect(low).toBeLessThan(85)
  })
})

describe('zScore', () => {
  it('computes standard deviations from the mean', () => {
    expect(zScore(110, 100, 5)).toBe(2)
    expect(zScore(100, 100, 5)).toBe(0)
  })

  it('returns 0 when SD is non-positive', () => {
    expect(zScore(110, 100, 0)).toBe(0)
  })
})
