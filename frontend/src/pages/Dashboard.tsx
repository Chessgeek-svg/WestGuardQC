import { useEffect, useState } from 'react'

import { getDashboard } from '../api/client'
import type { LotResults } from '../api/types'
import { LotTrackerCard } from '../components/LotTrackerCard'

export function Dashboard() {
  const [bundles, setBundles] = useState<LotResults[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyte, setAnalyte] = useState('all')

  useEffect(() => {
    let cancelled = false
    getDashboard()
      .then((data) => {
        if (!cancelled) setBundles(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-red-400">{error}</p>
  if (bundles.length === 0) {
    return <p className="text-slate-400">No active lots yet.</p>
  }

  const analytes = [...new Set(bundles.map((b) => b.analyte_name))].sort()
  const visible = analyte === 'all' ? bundles : bundles.filter((b) => b.analyte_name === analyte)

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="analyte-filter" className="text-sm font-medium">
          Analyte
        </label>
        <select
          id="analyte-filter"
          value={analyte}
          onChange={(e) => setAnalyte(e.target.value)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm"
        >
          <option value="all">All</option>
          {analytes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((bundle) => (
          <LotTrackerCard key={bundle.lot_id} data={bundle} />
        ))}
      </div>
    </div>
  )
}
