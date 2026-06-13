import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import type { Restaurant } from '../types/api'

interface ComparisonTableProps {
  restaurants: Restaurant[]
  rankMap: Map<string, number>
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-gray-400 dark:text-gray-600 text-sm">—</span>
  const full = Math.round(rating)
  return (
    <span className="text-sm">
      <span className="text-yellow-400">{'★'.repeat(full)}</span>
      <span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - full)}</span>
      <span className="ml-1 text-gray-600 dark:text-gray-400 text-xs">({rating})</span>
    </span>
  )
}

function PriceSymbols({ level }: { level: number | null }) {
  if (level === null) return <span className="text-gray-400 dark:text-gray-600 text-sm">—</span>
  return (
    <span className="text-sm">
      <span className="text-green-600 dark:text-green-400">{'$'.repeat(level)}</span>
      <span className="text-gray-300 dark:text-gray-600">{'$'.repeat(4 - level)}</span>
    </span>
  )
}

export function ComparisonTable({ restaurants, rankMap }: ComparisonTableProps) {
  const top = restaurants.slice(0, 3)
  if (top.length === 0) return null

  const ROWS: { label: string; render: (r: Restaurant) => React.ReactNode }[] = [
    {
      label: 'Rank',
      render: (r) => {
        const rank = rankMap.get(r.place_id)
        return rank !== undefined ? (
          <span
            className={clsx(
              'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold',
              rank === 1
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
            )}
          >
            {rank}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )
      },
    },
    {
      label: 'Rating',
      render: (r) => <Stars rating={r.rating} />,
    },
    {
      label: 'Price',
      render: (r) => <PriceSymbols level={r.price_level} />,
    },
    {
      label: 'Cuisine',
      render: (r) =>
        r.cuisine_types.length > 0 ? (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {r.cuisine_types.slice(0, 2).join(', ')}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      label: 'Hours',
      render: (r) =>
        r.hours ? (
          <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[140px] block truncate">
            {r.hours}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      label: 'Website',
      render: (r) =>
        r.website ? (
          <a
            href={r.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline text-sm"
          >
            Visit
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mb-8"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
        Side-by-Side Comparison
      </h2>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead>
            <tr>
              {/* Label column header */}
              <th className="w-28 min-w-[7rem] bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 px-4 py-3" />
              {top.map((r) => {
                const rank = rankMap.get(r.place_id)
                const isTop = rank === 1
                return (
                  <th
                    key={r.place_id}
                    className={clsx(
                      'border-b border-gray-200 dark:border-gray-700 px-4 py-3 text-left',
                      isTop
                        ? 'border-l-2 border-r-2 border-l-brand-500 border-r-brand-500 bg-brand-50/50 dark:bg-brand-900/10'
                        : 'bg-gray-50 dark:bg-gray-900/50',
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      {isTop && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                          Top Pick
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 max-w-[160px] block truncate">
                        {r.name}
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={clsx(
                  i % 2 === 0
                    ? 'bg-white dark:bg-gray-800'
                    : 'bg-gray-50/50 dark:bg-gray-900/20',
                )}
              >
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {row.label}
                </td>
                {top.map((r) => {
                  const rank = rankMap.get(r.place_id)
                  const isTop = rank === 1
                  return (
                    <td
                      key={r.place_id}
                      className={clsx(
                        'px-4 py-3',
                        isTop &&
                          'border-l-2 border-r-2 border-l-brand-500 border-r-brand-500 bg-brand-50/30 dark:bg-brand-900/10',
                      )}
                    >
                      {row.render(r)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
