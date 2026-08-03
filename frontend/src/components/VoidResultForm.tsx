import { type FormEvent, useState } from 'react'

import type { QCResult } from '../api/types'

interface VoidResultFormProps {
  result: QCResult
  onSubmit: (voidedBy: string, reason: string) => Promise<void>
  onCancel: () => void
}

/** Collects who is withdrawing a result and why.
 *
 *  Both are required, because a voided result without a reason is a gap in the
 *  record rather than an annotation of it. */
export function VoidResultForm({ result, onSubmit, onCancel }: VoidResultFormProps) {
  const [voidedBy, setVoidedBy] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(voidedBy, reason)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-3 rounded border border-slate-600 bg-slate-800/60 p-3 text-sm"
    >
      <p className="text-slate-300">
        Void the result of <span className="font-medium">{result.value}</span> from{' '}
        {new Date(result.recorded_at).toLocaleString()}? It stays on the record and stops counting
        toward the rules.
      </p>
      <label className="flex flex-col gap-1">
        <span>Your name</span>
        <input
          type="text"
          required
          value={voidedBy}
          onChange={(e) => setVoidedBy(e.target.value)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Reason</span>
        <input
          type="text"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Transcription error"
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {submitting ? 'Voiding…' : 'Void result'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-600 px-3 py-1.5 transition-colors hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
