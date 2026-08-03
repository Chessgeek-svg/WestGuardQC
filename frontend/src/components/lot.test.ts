import { describe, expect, it } from 'vitest'

import { makeResult, makeVoided } from '../test/fixtures'
import { isExpired, liveResults } from './lot'

describe('isExpired', () => {
  const noon = new Date(2026, 6, 8, 12, 0, 0)

  it('is false before the expiration date', () => {
    expect(isExpired('2026-07-09', noon)).toBe(false)
  })

  it('is false on the expiration date itself', () => {
    // A lot is usable through the whole of its final day.
    expect(isExpired('2026-07-08', noon)).toBe(false)
  })

  it('is true the day after', () => {
    expect(isExpired('2026-07-07', noon)).toBe(true)
  })
})

describe('liveResults', () => {
  it('drops voided results and keeps the rest in order', () => {
    const results = [makeResult({ id: 1 }), makeVoided({ id: 2 }), makeResult({ id: 3 })]
    expect(liveResults(results).map((r) => r.id)).toEqual([1, 3])
  })
})
