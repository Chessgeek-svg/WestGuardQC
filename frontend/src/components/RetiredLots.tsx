import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listLots } from '../api/client'
import type { QCLot } from '../api/types'

/** Links to lots that have been retired.
 *
 *  The dashboard only shows active lots, so without this a retired lot is
 *  reachable only by knowing its URL, and reactivating it means guessing an id.
 *  Collapsed by default, because the retired list is not the day's work. */
export function RetiredLots() {
  const [lots, setLots] = useState<QCLot[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    listLots(false)
      .then((data) => {
        if (!cancelled) setLots(data)
      })
      .catch(() => {
        // A dashboard that loaded is more useful than an error over a
        // secondary list, so a failure here just leaves it empty.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (lots.length === 0) return null

  return (
    <section className="mt-8 text-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-400 underline-offset-2 hover:text-slate-100 hover:underline"
      >
        {open ? 'Hide' : 'Show'} retired lots ({lots.length})
      </button>
      {open && (
        <ul className="mt-3 flex flex-col gap-2">
          {lots.map((lot) => (
            <li key={lot.id}>
              <Link
                to={`/lots/${lot.id}`}
                className="text-slate-300 underline-offset-2 hover:text-slate-100 hover:underline"
              >
                <span className="font-mono">{lot.lot_number}</span> {lot.level}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
