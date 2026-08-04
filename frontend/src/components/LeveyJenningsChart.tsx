import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { LotResults, ResultStatus } from '../api/types'
import {
  type ChartPoint,
  formatAxisValue,
  referenceLines,
  statusColor,
  statusLabel,
  toChartPoints,
  yDomain,
  zScore,
} from './chart-utils'

const LEGEND_STATUSES: ResultStatus[] = ['in_control', 'warning', 'rejected']

interface DotRenderProps {
  cx?: number
  cy?: number
  payload?: ChartPoint
}

interface TooltipRenderProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ChartPoint }>
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

interface LeveyJenningsChartProps {
  data: LotResults
  height?: number
  showCaption?: boolean
  showLegend?: boolean
  sdBands?: 'all' | 'two'
}

export function LeveyJenningsChart({
  data,
  height = 380,
  showCaption = true,
  showLegend = true,
  sdBands = 'all',
}: LeveyJenningsChartProps) {
  const { target_mean: mean, target_sd: sd } = data
  const points = toChartPoints(data.results)
  const lines = referenceLines(mean, sd).filter(
    (line) => sdBands === 'all' || line.kind === 'mean' || line.label.endsWith('2SD'),
  )
  // Voided points are still drawn, so the axis has to reach them too.
  const domain = yDomain(
    mean,
    sd,
    points.map((p) => p.value ?? p.voidedValue).filter((v): v is number => v !== null),
  )
  const hasVoided = points.some((p) => p.voided)

  const renderTooltip = ({ active, payload }: TooltipRenderProps) => {
    if (!active || !payload || payload.length === 0) return null
    const point = payload.find((entry) => entry.payload)?.payload
    if (!point) return null
    const value = point.value ?? point.voidedValue
    if (value === null) return null
    return (
      <div className="rounded border border-slate-300 bg-white p-2 text-sm text-slate-900 shadow dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
        <div className={`font-semibold ${point.voided ? 'text-slate-400 line-through' : ''}`}>
          {value} {data.unit}
        </div>
        <div>z = {zScore(value, mean, sd).toFixed(2)}</div>
        <div style={{ color: statusColor(point.status) }}>{statusLabel(point.status)}</div>
        {point.voided ? (
          <div className="text-slate-400">Not counted toward the rules or statistics</div>
        ) : (
          point.violations.length > 0 && (
            <div className="text-slate-400">{point.violations.join(', ')}</div>
          )
        )}
        <div className="text-slate-400">{formatTimestamp(point.recordedAt)}</div>
      </div>
    )
  }

  const renderDot = ({ cx, cy, payload }: DotRenderProps) => {
    if (cx === undefined || cy === undefined || payload === undefined) {
      return <g key="empty" />
    }
    const emphasized = payload.status === 'rejected' || payload.status === 'warning'
    return (
      <circle
        key={payload.t}
        cx={cx}
        cy={cy}
        r={emphasized ? 6 : 5}
        fill={statusColor(payload.status)}
        stroke="var(--lj-surface)"
        strokeWidth={2}
      />
    )
  }

  /** A voided result: the measurement still happened, so it stays on the chart,
   *  crossed out and greyed to show it carries no weight. */
  const renderVoidedDot = ({ cx, cy, payload }: DotRenderProps) => {
    if (cx === undefined || cy === undefined || payload === undefined) {
      return <g key="empty" />
    }
    const r = 5
    return (
      <g key={`voided-${payload.t}`} stroke={statusColor('voided')} strokeWidth={2}>
        <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
        <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
      </g>
    )
  }

  return (
    <figure className="w-full">
      {showCaption && (
        <figcaption className="mb-2">
          <h2 className="text-lg font-semibold">
            {data.analyte_name} <span className="text-slate-400">{data.level}</span>
          </h2>
          <p className="text-sm text-slate-400">
            Lot <span className="font-mono">{data.lot_number}</span>, target {mean} ± {sd}{' '}
            {data.unit}
          </p>
        </figcaption>
      )}

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 56, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--lj-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => new Date(t).toLocaleDateString()}
              stroke="var(--lj-muted)"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={domain}
              tickFormatter={(value: number) => formatAxisValue(value, sd)}
              stroke="var(--lj-muted)"
              tick={{ fontSize: 12 }}
              width={52}
            />
            <Tooltip content={renderTooltip} />
            {lines.map((line) => (
              <ReferenceLine
                key={line.key}
                y={line.y}
                stroke={line.kind === 'mean' ? 'var(--lj-mean)' : 'var(--lj-muted)'}
                strokeDasharray={line.kind === 'mean' ? undefined : '4 4'}
                label={{
                  value: line.label,
                  position: 'right',
                  fill: 'var(--lj-muted)',
                  fontSize: 11,
                }}
              />
            ))}
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--lj-secondary)"
              strokeWidth={2}
              isAnimationActive={false}
              // Voided points are null here, and the trend bridges the gap
              // rather than detouring through a result the rules ignored.
              connectNulls
              dot={renderDot}
              activeDot={false}
            />
            {hasVoided && (
              <Line
                type="linear"
                dataKey="voidedValue"
                stroke="none"
                isAnimationActive={false}
                dot={renderVoidedDot}
                activeDot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <ul className="mt-3 flex flex-wrap gap-4 text-sm" aria-label="Result status legend">
          {LEGEND_STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: statusColor(status) }}
              />
              {statusLabel(status)}
            </li>
          ))}
          {hasVoided && (
            <li className="flex items-center gap-2">
              <svg width="12" height="12" aria-hidden>
                <g stroke={statusColor('voided')} strokeWidth={2}>
                  <line x1="1" y1="1" x2="11" y2="11" />
                  <line x1="1" y1="11" x2="11" y2="1" />
                </g>
              </svg>
              Voided, not counted
            </li>
          )}
        </ul>
      )}
    </figure>
  )
}
