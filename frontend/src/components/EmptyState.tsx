import { motion } from 'framer-motion'
import { UtensilsCrossed } from 'lucide-react'

interface EmptyStateProps {
  onSubmit: (query: string) => void
}

const EXAMPLE_QUERIES = [
  'Romantic Italian in NYC',
  'Best ramen in San Francisco',
  'Rooftop bar in London',
  'Cheap tacos near downtown',
]

export function EmptyState({ onSubmit }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
        className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6"
      >
        <UtensilsCrossed className="w-10 h-10 text-gray-400 dark:text-gray-500" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2"
      >
        No restaurants found
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-gray-500 dark:text-gray-400 mb-8"
      >
        Try a different location or cuisine
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="flex flex-wrap gap-2 justify-center"
      >
        {EXAMPLE_QUERIES.map((q) => (
          <motion.button
            key={q}
            onClick={() => onSubmit(q)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors duration-150 shadow-sm"
          >
            {q}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}
