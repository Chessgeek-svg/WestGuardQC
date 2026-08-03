import type { QCResult, ResultStatus } from '../api/types'
import { liveResults } from './lot'

export { statusColor, statusLabel } from './status'

export interface RefLine {
  key: string
  label: string
  y: number
  kind: 'mean' | 'sd'
}

export interface ChartPoint {
  t: number
  value: number
  status: ResultStatus
  recordedAt: string
  violations: string[]
}

/** Mean plus the +/-1, 2, 3 SD boundary lines, from the lot's target stats. */
export function referenceLines(mean: number, sd: number): RefLine[] {
  const lines: RefLine[] = [{ key: 'mean', label: 'Mean', y: mean, kind: 'mean' }]
  for (const n of [1, 2, 3]) {
    lines.push({ key: `+${n}sd`, label: `+${n}SD`, y: mean + n * sd, kind: 'sd' })
    lines.push({ key: `-${n}sd`, label: `-${n}SD`, y: mean - n * sd, kind: 'sd' })
  }
  return lines
}

/** Map API results to chart points, x as epoch milliseconds for a time axis.
 *  Voided results are withdrawn from evaluation, so they are not plotted. */
export function toChartPoints(results: QCResult[]): ChartPoint[] {
  return liveResults(results).map((r) => ({
    t: new Date(r.recorded_at).getTime(),
    value: r.value,
    status: r.status,
    recordedAt: r.recorded_at,
    violations: r.westgard_violations ?? [],
  }))
}

/** Y range padded to always show the +/-3 SD lines and every point. */
export function yDomain(mean: number, sd: number, values: number[]): [number, number] {
  const low = Math.min(mean - 3 * sd, ...values)
  const high = Math.max(mean + 3 * sd, ...values)
  const pad = (high - low) * 0.05 || sd
  return [low - pad, high + pad]
}

export function zScore(value: number, mean: number, sd: number): number {
  return sd > 0 ? (value - mean) / sd : 0
}
