import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarCheck, ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react'
import type { Reservation } from '../types/api'

interface ReservationPanelProps {
  reservation: Reservation
}

export function ReservationPanel({ reservation }: ReservationPanelProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reservation.draft_message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = reservation.draft_message
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
      aria-label="Reservation"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 bg-gray-900 dark:bg-gray-950 text-white">
        <CalendarCheck className="w-5 h-5 shrink-0" />
        <h2 className="font-semibold text-base">Book a Table</h2>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Restaurant + CTA */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide mb-0.5">
              Restaurant
            </p>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
              {reservation.name}
            </p>
          </div>

          <motion.a
            href={reservation.deep_link}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-semibold text-sm shadow-sm hover:shadow-brand-600/30 hover:shadow-md transition-all duration-200"
          >
            <CalendarCheck className="w-4 h-4" />
            Reserve / Book
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </motion.a>
        </div>

        {/* Draft message */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Draft Message
            </p>
            <motion.button
              onClick={handleCopy}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors duration-150 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              aria-label="Copy draft message"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5 text-green-600 dark:text-green-400"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          <textarea
            readOnly
            value={reservation.draft_message}
            rows={5}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed font-mono"
            aria-label="Draft reservation message"
          />
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <strong>No slots guaranteed</strong> — this is a draft message to send to the
            restaurant. Availability is subject to change. Always confirm directly with the
            restaurant.
          </p>
        </div>
      </div>
    </motion.section>
  )
}
