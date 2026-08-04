import type { QCResult, ResultStatus } from '../api/types'

export { statusColor, statusLabel } from './status'

export interface RefLine {
  key: string
  label: string
  y: number
  kind: 'mean' | 'sd'
}

export interface ChartPoint {
  t: number
  /** The measured value, or null when voided, which breaks the trend line. */
  value: number | null
  /** Set only when voided, so voided points draw as their own marker series. */
  voidedValue: number | null
  voided: boolean
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
 *
 *  Voided results stay on the chart, drawn as a crossed-out marker, so the run
 *  still shows that something was measured that day. They are split onto a
 *  separate key: the trend line follows `value` and skips them, because the
 *  line traces the results the rules actually acted on. */
export function toChartPoints(results: QCResult[]): ChartPoint[] {
  return results.map((r) => {
    const voided = r.voided_at !== null
    return {
      t: new Date(r.recorded_at).getTime(),
      value: voided ? null : r.value,
      voidedValue: voided ? r.value : null,
      voided,
      status: r.status,
      recordedAt: r.recorded_at,
      violations: r.westgard_violations ?? [],
    }
  })
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

/** Format a y-axis tick to a precision the lot's SD justifies.
 *
 *  The domain is arithmetic on floats, so a tick lands on values like
 *  11.999999999999998. Rendered raw those overflow the axis gutter and get
 *  clipped mid-number, which is how ")0000002" ends up on a chart. How many
 *  decimals are meaningful follows the SD: a control with an SD of 0.4 needs
 *  two, one with an SD of 7.5 does not. */
export function formatAxisValue(value: number, sd: number): string {
  const decimals = sd >= 10 ? 0 : sd >= 1 ? 1 : 2
  return value.toFixed(decimals)
}
