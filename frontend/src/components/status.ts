import type { ResultStatus } from '../api/types'

const STATUS_COLOR: Record<ResultStatus, string> = {
  in_control: 'var(--lj-status-in_control)',
  warning: 'var(--lj-status-warning)',
  rejected: 'var(--lj-status-rejected)',
  pending: 'var(--lj-status-pending)',
}

const STATUS_LABEL: Record<ResultStatus, string> = {
  in_control: 'In control',
  warning: 'Warning',
  rejected: 'Rejected',
  pending: 'Pending',
}

export function statusColor(status: ResultStatus): string {
  return STATUS_COLOR[status]
}

export function statusLabel(status: ResultStatus): string {
  return STATUS_LABEL[status]
}
