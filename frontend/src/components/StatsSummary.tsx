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
      <div className="mb-3 flex items-center gap-2">
        {stats.latestStatus ? (
          <StatusBadge status={stats.latestStatus} />
        ) : (
          <span className="text-slate-400">No data</span>
        )}
        <span className="text-slate-400">N = {stats.n}</span>
      </div>

      <table className="w-full tabular-nums">
        <thead>
          <tr className="text-xs tracking-wide text-slate-400 uppercase">
            <th className="text-left font-medium">Statistic</th>
            <th className="pb-1 text-right font-medium">Observed</th>
            {!compact && <th className="pb-1 text-right font-medium">Target</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-0.5 text-slate-400">{row.label}</td>
              <td className="py-0.5 text-right font-medium text-slate-100">{fmt(row.observed)}</td>
              {!compact && (
                <td className="py-0.5 text-right text-slate-400">
                  {row.target === null ? '—' : row.target}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
