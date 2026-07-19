import type { QCResult } from '../api/types'
import { StatusBadge } from './StatusBadge'

export function ResultsTable({ results }: { results: QCResult[] }) {
  const newestFirst = [...results].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  )

  if (newestFirst.length === 0) {
    return <p className="text-sm text-slate-400">No results recorded.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-400">
          <th className="py-2 pr-4 font-medium">Recorded</th>
          <th className="py-2 pr-4 font-medium">Value</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 font-medium">Violations</th>
        </tr>
      </thead>
      <tbody>
        {newestFirst.map((result) => (
          <tr key={result.id} className="border-t border-slate-700">
            <td className="py-2 pr-4">{new Date(result.recorded_at).toLocaleString()}</td>
            <td className="py-2 pr-4 tabular-nums">{result.value}</td>
            <td className="py-2 pr-4">
              <StatusBadge status={result.status} />
            </td>
            <td className="py-2 text-slate-400">
              {result.westgard_violations && result.westgard_violations.length > 0
                ? result.westgard_violations.join(', ')
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
