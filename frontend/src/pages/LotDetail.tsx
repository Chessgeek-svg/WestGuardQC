import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getLotResults, updateLot, voidResult } from '../api/client'
import type { LotResults, QCResult } from '../api/types'
import { ExpiredBadge } from '../components/ExpiredBadge'
import { LeveyJenningsChart } from '../components/LeveyJenningsChart'
import { formatExpiry, isExpired } from '../components/lot'
import { ResultEntryForm } from '../components/ResultEntryForm'
import { ResultsTable } from '../components/ResultsTable'
import { StatsSummary } from '../components/StatsSummary'
import { VoidResultForm } from '../components/VoidResultForm'

export function LotDetail() {
  const { lotId } = useParams()
  const id = Number(lotId)
  const [data, setData] = useState<LotResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<QCResult | null>(null)

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

  const handleVoid = async (voidedBy: string, reason: string) => {
    if (!voiding) return
    try {
      await voidResult(voiding.id, { voided_by: voidedBy, void_reason: reason })
      setVoiding(null)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to void result')
    }
  }

  const handleRetire = async () => {
    try {
      await updateLot(id, { active: false })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retire lot')
    }
  }

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
              <ResultsTable
                results={data.results}
                onVoid={setVoiding}
                voidingId={voiding?.id ?? null}
                voidForm={
                  voiding && (
                    <VoidResultForm
                      result={voiding}
                      onSubmit={handleVoid}
                      onCancel={() => setVoiding(null)}
                    />
                  )
                }
              />
            </section>
          </div>
          <div className="space-y-8">
            <section className="text-sm">
              <h3 className="mb-2 font-semibold">Lot</h3>
              <dl className="space-y-1">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Number</dt>
                  <dd className="font-mono">{data.lot_number}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Expires</dt>
                  <dd className="flex items-center gap-2">
                    {formatExpiry(data.expiration_date)}
                    {isExpired(data.expiration_date) && <ExpiredBadge />}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">State</dt>
                  <dd>{data.active ? 'Active' : 'Retired'}</dd>
                </div>
              </dl>
              {data.active && (
                <button
                  type="button"
                  onClick={() => void handleRetire()}
                  className="mt-3 rounded border border-slate-600 px-3 py-1.5 transition-colors hover:border-slate-400"
                >
                  Retire lot
                </button>
              )}
            </section>
            <StatsSummary data={data} />
            {data.active && <ResultEntryForm lotId={id} onCreated={() => void load()} />}
          </div>
        </div>
      )}
    </div>
  )
}
