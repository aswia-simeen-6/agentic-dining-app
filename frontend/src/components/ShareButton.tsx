import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Check } from 'lucide-react'

interface ShareButtonProps {
  sessionId: string
}

export function ShareButton({ sessionId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/r/${sessionId}`

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = shareUrl
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.button
      onClick={handleShare}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 px-4 py-2 text-sm font-semibold transition-colors duration-200"
      aria-label="Share results"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 text-green-600 dark:text-green-400"
          >
            <Check className="w-4 h-4" />
            Copied!
          </motion.span>
        ) : (
          <motion.span
            key="share"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share Results
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
