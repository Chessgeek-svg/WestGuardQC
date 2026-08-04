import { Fragment, type ReactNode } from 'react'

import type { QCResult } from '../api/types'
import { StatusBadge } from './StatusBadge'

interface ResultsTableProps {
  results: QCResult[]
  onVoid?: (result: QCResult) => void
  /** The result whose void form is open. The form is rendered in a row of its
   *  own directly under that result, so it stays next to the Void button that
   *  opened it rather than at the foot of a run that can be dozens of rows. */
  voidingId?: number | null
  voidForm?: ReactNode
}

export function ResultsTable({ results, onVoid, voidingId, voidForm }: ResultsTableProps) {
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
          <th className="py-2 pr-4 font-medium">Violations</th>
          {onVoid && <th className="py-2 font-medium">Action</th>}
        </tr>
      </thead>
      <tbody>
        {newestFirst.map((result) => {
          const voided = result.voided_at !== null
          return (
            <Fragment key={result.id}>
              <tr className="border-t border-slate-700">
                <td className={`py-2 pr-4 ${voided ? 'text-slate-500 line-through' : ''}`}>
                  {new Date(result.recorded_at).toLocaleString()}
                </td>
                <td
                  className={`py-2 pr-4 tabular-nums ${voided ? 'text-slate-500 line-through' : ''}`}
                >
                  {result.value}
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={result.status} />
                </td>
                <td className="py-2 pr-4 text-slate-400">
                  {voided
                    ? `Voided by ${result.voided_by}: ${result.void_reason}`
                    : (result.westgard_violations?.join(', ') ?? '')}
                </td>
                {onVoid && (
                  <td className="py-2">
                    {!voided && (
                      <button
                        type="button"
                        onClick={() => onVoid(result)}
                        className="text-slate-400 underline-offset-2 hover:text-slate-100 hover:underline"
                      >
                        Void
                      </button>
                    )}
                  </td>
                )}
              </tr>
              {voidForm && result.id === voidingId && (
                <tr>
                  <td colSpan={onVoid ? 5 : 4} className="pb-3">
                    <div className="max-w-md">{voidForm}</div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
