import { motion } from 'framer-motion'
import { Trophy, Medal, Award, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import type { Recommendation, Restaurant } from '../types/api'

interface RecommendPanelProps {
  recommendation: Recommendation
  restaurants: Restaurant[]
}

const rankIcons = [
  { Icon: Trophy, color: 'text-amber-500' },
  { Icon: Medal, color: 'text-gray-400' },
  { Icon: Award, color: 'text-amber-700' },
]

function getRestaurantName(placeId: string, restaurants: Restaurant[]): string {
  return restaurants.find((r) => r.place_id === placeId)?.name ?? placeId
}

export function RecommendPanel({ recommendation, restaurants }: RecommendPanelProps) {
  const sorted = [...recommendation.ranked].sort((a, b) => a.rank - b.rank)

  return (
    <motion.section
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-2xl border border-brand-100 dark:border-brand-900/50 bg-brand-50/50 dark:bg-brand-900/10 overflow-hidden"
      aria-label="Recommendations"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 bg-brand-600 text-white">
        <Sparkles className="w-5 h-5 shrink-0" />
        <h2 className="font-semibold text-base">AI Recommendations</h2>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Ranked list */}
        <div className="flex flex-col gap-3">
          {sorted.map((item, i) => {
            const isTop = item.rank === 1
            const rankEntry = rankIcons[i] ?? rankIcons[rankIcons.length - 1]
            const { Icon, color } = rankEntry
            const name = getRestaurantName(item.place_id, restaurants)

            return (
              <motion.div
                key={item.place_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3, ease: 'easeOut' }}
                className={clsx(
                  'rounded-xl p-4 border transition-colors',
                  isTop
                    ? 'bg-white dark:bg-gray-800 border-brand-300 dark:border-brand-700 shadow-sm'
                    : 'bg-white/70 dark:bg-gray-800/70 border-gray-200 dark:border-gray-700',
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={clsx('w-5 h-5 shrink-0 mt-0.5', color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                        {name}
                      </span>
                      {isTop && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-600 text-white">
                          Top Pick
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                      {item.reason}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Overall explanation */}
        {recommendation.explanation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500 mb-2">
              Analysis
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {recommendation.explanation}
            </p>
          </motion.div>
        )}
      </div>
    </motion.section>
  )
}
