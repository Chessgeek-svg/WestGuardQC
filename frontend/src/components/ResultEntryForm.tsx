import { type FormEvent, useState } from 'react'

import { createResult } from '../api/client'
import type { QCResult } from '../api/types'
import { statusColor, statusLabel } from './chart-utils'

export function ResultEntryForm({ lotId, onCreated }: { lotId: number; onCreated: () => void }) {
  const [value, setValue] = useState('')
  const [recordedBy, setRecordedBy] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<QCResult | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await createResult({
        qc_lot_id: lotId,
        value: Number(value),
        recorded_by: recordedBy,
        recorded_at: recordedAt ? new Date(recordedAt).toISOString() : undefined,
      })
      setLastResult(result)
      setValue('')
      setRecordedAt('')
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record result')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="font-semibold">Record a result</h3>
      <label className="flex flex-col gap-1 text-sm">
        <span>Value</span>
        <input
          type="number"
          step="any"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Recorded by</span>
        <input
          type="text"
          required
          value={recordedBy}
          onChange={(e) => setRecordedBy(e.target.value)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Recorded at (optional)</span>
        <input
          type="datetime-local"
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        {submitting ? 'Recording…' : 'Record'}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {lastResult && (
        <p className="text-sm" style={{ color: statusColor(lastResult.status) }}>
          Recorded {lastResult.value}: {statusLabel(lastResult.status)}
          {lastResult.westgard_violations && lastResult.westgard_violations.length > 0
            ? ` (${lastResult.westgard_violations.join(', ')})`
            : ''}
        </p>
      )}
    </form>
  )
}
