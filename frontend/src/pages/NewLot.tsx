import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { createAnalyte, createLot, listAnalytes } from '../api/client'
import type { Analyte } from '../api/types'

const FIELD = 'rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100'

/** The sentinel option that reveals the new-analyte fields. */
const NEW = 'new'

export function NewLot() {
  const navigate = useNavigate()
  const [analytes, setAnalytes] = useState<Analyte[]>([])
  const [analyteId, setAnalyteId] = useState('')
  const [analyteName, setAnalyteName] = useState('')
  const [analyteUnit, setAnalyteUnit] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [level, setLevel] = useState('Level 1')
  const [manufacturer, setManufacturer] = useState('')
  const [targetMean, setTargetMean] = useState('')
  const [targetSd, setTargetSd] = useState('')
  const [expiration, setExpiration] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listAnalytes()
      .then((data) => {
        if (cancelled) return
        setAnalytes(data)
        // With nothing to pick from, the only path forward is a new analyte.
        setAnalyteId(data.length > 0 ? String(data[0].id) : NEW)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analytes')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      // A brand new analyte has to exist before the lot can point at it.
      const id =
        analyteId === NEW
          ? (await createAnalyte({ name: analyteName, unit: analyteUnit })).id
          : Number(analyteId)
      const lot = await createLot({
        analyte_id: id,
        lot_number: lotNumber,
        manufacturer,
        level,
        target_mean: Number(targetMean),
        target_sd: Number(targetSd),
        expiration_date: expiration,
      })
      void navigate(`/lots/${lot.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lot')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Link to="/" className="text-sm text-slate-400 hover:underline">
        ← Back to dashboard
      </Link>

      <h2 className="mt-4 text-lg font-semibold">New control lot</h2>

      <form onSubmit={submit} className="mt-4 flex max-w-md flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span>Analyte</span>
          <select
            value={analyteId}
            onChange={(e) => setAnalyteId(e.target.value)}
            className={FIELD}
          >
            {analytes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.unit})
              </option>
            ))}
            <option value={NEW}>New analyte…</option>
          </select>
        </label>

        {analyteId === NEW && (
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span>Analyte name</span>
              <input
                type="text"
                required
                value={analyteName}
                onChange={(e) => setAnalyteName(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="flex w-32 flex-col gap-1">
              <span>Unit</span>
              <input
                type="text"
                required
                placeholder="mg/dL"
                value={analyteUnit}
                onChange={(e) => setAnalyteUnit(e.target.value)}
                className={FIELD}
              />
            </label>
          </div>
        )}

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span>Lot number</span>
            <input
              type="text"
              required
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span>Level</span>
            <input
              type="text"
              required
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span>Manufacturer</span>
          <input
            type="text"
            required
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className={FIELD}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span>Target mean</span>
            <input
              type="number"
              step="any"
              required
              value={targetMean}
              onChange={(e) => setTargetMean(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span>Target SD</span>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={targetSd}
              onChange={(e) => setTargetSd(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span>Expiration date</span>
          <input
            type="date"
            required
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
            className={FIELD}
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create lot'}
        </button>

        {error && <p className="text-red-400">{error}</p>}
      </form>
    </div>
  )
}
