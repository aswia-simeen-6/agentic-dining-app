import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sun, Moon, UtensilsCrossed, Sparkles } from 'lucide-react'
import { SearchBar } from './components/SearchBar'
import { PipelineProgress } from './components/PipelineProgress'
import { RestaurantCard } from './components/RestaurantCard'
import { RecommendPanel } from './components/RecommendPanel'
import { ReservationPanel } from './components/ReservationPanel'
import { ErrorBanner } from './components/ErrorBanner'
import { SkeletonCard } from './components/SkeletonCard'
import { MapView } from './components/MapView'
import { ComparisonTable } from './components/ComparisonTable'
import { ShareButton } from './components/ShareButton'
import { EmptyState } from './components/EmptyState'
import { usePipeline } from './hooks/usePipeline'

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  return [dark, setDark] as const
}

const SKELETON_COUNT = 3

export default function App() {
  const [dark, setDark] = useDarkMode()
  const {
    currentStep,
    restaurants,
    recommendation,
    reservation,
    errors,
    isStreaming,
    sessionId,
    shareUrl,
    submitQuery,
    cancel,
    dismissError,
  } = usePipeline()

  const isActive = currentStep !== 'idle'
  const isLoading = isStreaming && restaurants.length === 0
  const showSkeletons = isLoading

  // Map ranked place_ids for card rank display
  const rankMap = new Map<string, number>()
  if (recommendation) {
    for (const r of recommendation.ranked) {
      rankMap.set(r.place_id, r.rank)
    }
  }

  // Sort restaurants by rank if we have recommendation data
  const sortedRestaurants =
    recommendation && restaurants.length > 0
      ? [...restaurants].sort((a, b) => {
          const ra = rankMap.get(a.place_id) ?? 999
          const rb = rankMap.get(b.place_id) ?? 999
          return ra - rb
        })
      : restaurants

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
              <UtensilsCrossed className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-base hidden sm:block">
              Agentic Dining
            </span>
          </div>

          <button
            onClick={() => setDark((d) => !d)}
            className="rounded-xl p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {dark ? (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="w-5 h-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ opacity: 0, rotate: 90, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -90, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="w-5 h-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-20">
        {/* Hero */}
        <AnimatePresence>
          {!isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center pt-16 pb-10"
            >
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-sm font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Powered by AI + Google Places
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mb-4">
                Find Your Perfect{' '}
                <span className="text-brand-600 dark:text-brand-400">Dining Experience</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
                Describe what you&apos;re looking for and our AI agents will find, rank, and
                help you book the best restaurants in real time.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact heading when active */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="pt-6 pb-5 text-center"
            >
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Agentic Dining
              </h1>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-5"
            >
              <ErrorBanner errors={errors} onDismiss={dismissError} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search bar */}
        <div className={isActive ? 'mb-6' : 'mb-0'}>
          <SearchBar onSubmit={submitQuery} onCancel={cancel} isStreaming={isStreaming} />
        </div>

        {/* Pipeline progress */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-8 px-1"
            >
              <PipelineProgress currentStep={currentStep} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Restaurant grid */}
        <AnimatePresence>
          {(showSkeletons || sortedRestaurants.length > 0) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                {showSkeletons ? 'Searching…' : `${sortedRestaurants.length} Restaurant${sortedRestaurants.length !== 1 ? 's' : ''} Found`}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {showSkeletons
                  ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))
                  : sortedRestaurants.map((r, i) => (
                      <RestaurantCard
                        key={r.place_id}
                        restaurant={r}
                        index={i}
                        rank={rankMap.get(r.place_id)}
                      />
                    ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map view */}
        <AnimatePresence>
          {sortedRestaurants.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MapView restaurants={sortedRestaurants} rankMap={rankMap} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comparison table */}
        <AnimatePresence>
          {sortedRestaurants.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ComparisonTable restaurants={sortedRestaurants} rankMap={rankMap} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        <AnimatePresence>
          {currentStep === 'complete' && sortedRestaurants.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <EmptyState onSubmit={submitQuery} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recommendation panel */}
        <AnimatePresence>
          {recommendation && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-5"
            >
              <RecommendPanel
                recommendation={recommendation}
                restaurants={sortedRestaurants}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reservation panel */}
        <AnimatePresence>
          {reservation && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-5"
            >
              <ReservationPanel reservation={reservation} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share button */}
        <AnimatePresence>
          {currentStep === 'complete' && shareUrl && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center mt-4 mb-5"
            >
              <ShareButton sessionId={sessionId} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-600">
          Restaurant data provided by{' '}
          <a
            href="https://developers.google.com/maps/documentation/places/web-service"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            Google Places API
          </a>
          . Reviews shown with author attribution per Google Terms of Service.
        </p>
      </footer>
    </div>
  )
}
