import type { QCResult, ResultStatus } from '../api/types'
import { liveResults } from './lot'

export interface ObservedStats {
  n: number
  mean: number | null
  sd: number | null
  cv: number | null
  last10Average: number | null
  latestStatus: ResultStatus | null
}

const EMPTY: ObservedStats = {
  n: 0,
  mean: null,
  sd: null,
  cv: null,
  last10Average: null,
  latestStatus: null,
}

/** Observed statistics for a lot's results: sample SD (n-1), CV%, and the
 *  average of the ten most recent values. Nulls where undefined (empty set,
 *  or SD/CV that need more than one point or a non-zero mean).
 *
 *  Voided results are excluded, so a withdrawn entry stops skewing the
 *  observed mean and SD the moment it is voided. */
export function observedStats(results: QCResult[]): ObservedStats {
  const live = liveResults(results)
  const n = live.length
  if (n === 0) return EMPTY

  const byTime = [...live].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  )
  const values = byTime.map((r) => r.value)
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)) : null
  const cv = sd !== null && mean !== 0 ? (sd / mean) * 100 : null

  const last10 = values.slice(-10)
  const last10Average = last10.reduce((sum, v) => sum + v, 0) / last10.length

  return { n, mean, sd, cv, last10Average, latestStatus: byTime[n - 1].status }
}
