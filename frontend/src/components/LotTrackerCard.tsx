import { Link } from 'react-router-dom'

import type { LotResults } from '../api/types'
import { ExpiredBadge } from './ExpiredBadge'
import { LeveyJenningsChart } from './LeveyJenningsChart'
import { isExpired, liveResults } from './lot'
import { StatsSummary } from './StatsSummary'

export function LotTrackerCard({ data }: { data: LotResults }) {
  return (
    <Link
      to={`/lots/${data.lot_id}`}
      className="block rounded-lg border border-slate-700 bg-slate-800 p-4 transition-colors hover:border-slate-500"
    >
      <div className="mb-2">
        <h3 className="font-semibold">
          {data.analyte_name} <span className="text-slate-400">{data.level}</span>
        </h3>
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-mono">{data.lot_number}</span>
          <span>{data.unit}</span>
          {isExpired(data.expiration_date) && <ExpiredBadge />}
        </p>
      </div>

      {liveResults(data.results).length > 0 ? (
        <LeveyJenningsChart
          data={data}
          height={160}
          showCaption={false}
          showLegend={false}
          sdBands="two"
        />
      ) : (
        <div className="flex h-[160px] items-center justify-center text-sm text-slate-400">
          No results yet
        </div>
      )}

      <div className="mt-3">
        <StatsSummary data={data} compact />
      </div>
    </Link>
  )
}
