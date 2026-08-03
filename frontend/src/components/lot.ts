import type { QCResult } from '../api/types'

/** Results still counting toward rules, charts, and observed statistics.
 *
 *  Voided results stay in the payload so the table can show them as withdrawn
 *  history, so every consumer that does maths has to filter them out. One
 *  definition here keeps the chart and the statistics from disagreeing. */
export function liveResults(results: QCResult[]): QCResult[] {
  return results.filter((r) => r.voided_at === null)
}

/** True once the lot's expiration date has passed.
 *
 *  Expiry is a calendar date, not an instant, so a lot stays usable through
 *  the whole of its final day. Comparing against the start of today rather
 *  than the current time avoids retiring a lot at some arbitrary hour. */
export function isExpired(expirationDate: string, now: Date = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [year, month, day] = expirationDate.split('-').map(Number)
  return new Date(year, month - 1, day) < today
}

/** Expiry rendered for display, e.g. "1 Jan 2027". */
export function formatExpiry(expirationDate: string): string {
  const [year, month, day] = expirationDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })
}
