import { useCallback, useEffect, useState } from 'react'

import { getLotResults } from './api/client'
import type { LotResults } from './api/types'
import { LeveyJenningsChart } from './components/LeveyJenningsChart'
import { LotSelector } from './components/LotSelector'
import { ResultEntryForm } from './components/ResultEntryForm'

function App() {
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null)
  const [lotResults, setLotResults] = useState<LotResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadResults = useCallback(async (lotId: number) => {
    setLoading(true)
    setError(null)
    try {
      setLotResults(await getLotResults(lotId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load results')
      setLotResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedLotId !== null) void loadResults(selectedLotId)
  }, [selectedLotId, loadResults])

  return (
    <main className="mx-auto max-w-5xl p-6 text-slate-900 dark:text-slate-100">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">WestGuardQC</h1>
        <p className="text-sm text-slate-500">Levey-Jennings QC monitoring</p>
      </header>

      <div className="mb-6 max-w-md">
        <LotSelector selectedLotId={selectedLotId} onSelect={setSelectedLotId} />
      </div>

      {selectedLotId === null && <p className="text-slate-500">Select a lot to view its chart.</p>}
      {error && <p className="text-red-600">{error}</p>}
      {loading && <p className="text-slate-500">Loading…</p>}

      {selectedLotId !== null && lotResults && (
        <div className="grid gap-8 md:grid-cols-[1fr_18rem]">
          <LeveyJenningsChart data={lotResults} />
          <ResultEntryForm
            lotId={selectedLotId}
            onCreated={() => void loadResults(selectedLotId)}
          />
        </div>
      )}
    </main>
  )
}

export default App
