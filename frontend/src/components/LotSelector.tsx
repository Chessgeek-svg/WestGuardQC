import { useEffect, useState } from 'react'

import { listAnalytes, listLots } from '../api/client'
import type { Analyte, QCLot } from '../api/types'

interface LotOption {
  id: number
  label: string
}

function buildOptions(analytes: Analyte[], lots: QCLot[]): LotOption[] {
  const nameById = new Map(analytes.map((a) => [a.id, a.name]))
  return lots.map((lot) => ({
    id: lot.id,
    label: `${nameById.get(lot.analyte_id) ?? 'Unknown'} — ${lot.level} (lot ${lot.lot_number})`,
  }))
}

export function LotSelector({
  selectedLotId,
  onSelect,
}: {
  selectedLotId: number | null
  onSelect: (lotId: number) => void
}) {
  const [options, setOptions] = useState<LotOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listAnalytes(), listLots({ activeOnly: true })])
      .then(([analytes, lots]) => {
        if (!cancelled) setOptions(buildOptions(analytes, lots))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load lots')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">QC lot</span>
      <select
        className="rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
        value={selectedLotId ?? ''}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        <option value="" disabled>
          {options.length === 0 ? 'No active lots' : 'Select a lot…'}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
