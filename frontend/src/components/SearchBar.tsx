import { useState, useRef, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { Search, X, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface SearchBarProps {
  onSubmit: (query: string) => void
  onCancel: () => void
  isStreaming: boolean
}

const PLACEHOLDER_EXAMPLES = [
  'Romantic Italian restaurant in NYC for 2…',
  'Best sushi near downtown Chicago…',
  'Cozy brunch spot in San Francisco…',
  'Vegan-friendly dinner in Austin, TX…',
]

export function SearchBar({ onSubmit, onCancel, isStreaming }: SearchBarProps) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [placeholderIdx] = useState(() =>
    Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSubmit(trimmed)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape' && isStreaming) onCancel()
  }

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.div
        className={clsx(
          'flex items-center gap-2 rounded-2xl border-2 bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200 px-4 py-3',
          isFocused
            ? 'border-brand-500 shadow-brand-100 dark:shadow-brand-900/30 shadow-md'
            : 'border-gray-200 dark:border-gray-700',
        )}
        animate={{ scale: isFocused ? 1.01 : 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <Search
          className={clsx(
            'shrink-0 w-5 h-5 transition-colors duration-200',
            isFocused ? 'text-brand-600' : 'text-gray-400',
          )}
        />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={PLACEHOLDER_EXAMPLES[placeholderIdx]}
          disabled={isStreaming}
          className={clsx(
            'flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'text-base disabled:opacity-60',
          )}
          aria-label="Dining query"
        />

        {value && !isStreaming && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => {
              setValue('')
              inputRef.current?.focus()
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Clear"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}

        {isStreaming ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 px-3 py-1.5 text-sm font-medium transition-colors"
            aria-label="Cancel search"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!value.trim()}
            className={clsx(
              'shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold transition-all duration-200',
              value.trim()
                ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow-brand-600/30 hover:shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed',
            )}
            aria-label="Search"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </motion.button>
        )}
      </motion.div>

      {isStreaming && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2"
        >
          Finding the best dining options for you…
        </motion.p>
      )}
    </motion.div>
  )
}
