import type { ResultStatus } from '../api/types'
import { statusColor, statusLabel } from './status'

export function StatusBadge({ status }: { status: ResultStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium dark:border-slate-600">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: statusColor(status) }}
        aria-hidden
      />
      {statusLabel(status)}
    </span>
  )
}
