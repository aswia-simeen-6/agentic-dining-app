import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface ErrorBannerProps {
  errors: string[]
  onDismiss: (index: number) => void
}

export function ErrorBanner({ errors, onDismiss }: ErrorBannerProps) {
  if (errors.length === 0) return null

  return (
    <div className="flex flex-col gap-2 w-full" role="alert" aria-live="polite">
      <AnimatePresence initial={false}>
        {errors.map((error, index) => (
          <motion.div
            key={`${error}-${index}`}
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            layout
            className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
              {error}
            </p>
            <button
              onClick={() => onDismiss(index)}
              className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors rounded-md p-0.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label={`Dismiss error: ${error}`}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
