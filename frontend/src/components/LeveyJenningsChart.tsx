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

export function LeveyJenningsChart({ data }: { data: LotResults }) {
  const { target_mean: mean, target_sd: sd } = data
  const points = toChartPoints(data.results)
  const lines = referenceLines(mean, sd)
  const domain = yDomain(
    mean,
    sd,
    points.map((p) => p.value),
  )

  const renderTooltip = ({ active, payload }: TooltipRenderProps) => {
    if (!active || !payload || payload.length === 0) return null
    const point = payload[0].payload
    if (!point) return null
    return (
      <div className="rounded border border-slate-300 bg-white p-2 text-sm text-slate-900 shadow dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
        <div className="font-semibold">
          {point.value} {data.unit}
        </div>
        <div>z = {zScore(point.value, mean, sd).toFixed(2)}</div>
        <div style={{ color: statusColor(point.status) }}>{statusLabel(point.status)}</div>
        {point.violations.length > 0 && (
          <div className="text-slate-500">{point.violations.join(', ')}</div>
        )}
        <div className="text-slate-500">{formatTimestamp(point.recordedAt)}</div>
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

  return (
    <figure className="w-full">
      <figcaption className="mb-2">
        <h2 className="text-lg font-semibold">
          {data.analyte_name} <span className="text-slate-500">— {data.level}</span>
        </h2>
        <p className="text-sm text-slate-500">
          Target {mean} ± {sd} {data.unit}
        </p>
      </figcaption>

      <div className="h-[380px] w-full">
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
            <YAxis domain={domain} stroke="var(--lj-muted)" tick={{ fontSize: 12 }} width={48} />
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
              dot={renderDot}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

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
      </ul>
    </figure>
  )
}
