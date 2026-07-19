import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getLotResults } from '../api/client'
import type { LotResults } from '../api/types'
import { LeveyJenningsChart } from '../components/LeveyJenningsChart'
import { ResultEntryForm } from '../components/ResultEntryForm'
import { ResultsTable } from '../components/ResultsTable'
import { StatsSummary } from '../components/StatsSummary'

export function LotDetail() {
  const { lotId } = useParams()
  const id = Number(lotId)
  const [data, setData] = useState<LotResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getLotResults(id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load lot')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <Link to="/" className="text-sm text-slate-400 hover:underline">
        ← Back to dashboard
      </Link>

      {loading && <p className="mt-4 text-slate-400">Loading…</p>}
      {error && <p className="mt-4 text-red-400">{error}</p>}

      {data && (
        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div>
            <LeveyJenningsChart data={data} />
            <section className="mt-8">
              <h3 className="mb-2 font-semibold">Recent results</h3>
              <ResultsTable results={data.results} />
            </section>
          </div>
          <div className="space-y-8">
            <StatsSummary data={data} />
            <ResultEntryForm lotId={id} onCreated={() => void load()} />
          </div>
        </div>
      )}
    </div>
  )
}
