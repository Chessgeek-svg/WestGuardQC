import type { LotResults } from '../api/types'
import { observedStats } from './stats'
import { StatusBadge } from './StatusBadge'

function fmt(value: number | null, digits = 1): string {
  return value === null ? '—' : value.toFixed(digits)
}

export function StatsSummary({ data, compact = false }: { data: LotResults; compact?: boolean }) {
  const stats = observedStats(data.results)
  const rows: { label: string; observed: number | null; target: number | null }[] = [
    { label: 'Mean', observed: stats.mean, target: data.target_mean },
    { label: 'SD', observed: stats.sd, target: data.target_sd },
    { label: 'CV%', observed: stats.cv, target: null },
    { label: 'Last-10 avg', observed: stats.last10Average, target: null },
  ]

  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center gap-2">
        {stats.latestStatus ? (
          <StatusBadge status={stats.latestStatus} />
        ) : (
          <span className="text-slate-500">No data</span>
        )}
        <span className="text-slate-500">N = {stats.n}</span>
      </div>
      <dl className="grid grid-cols-1 gap-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="tabular-nums">
              {fmt(row.observed)}
              {!compact && row.target !== null && (
                <span className="text-slate-400"> / {row.target}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
