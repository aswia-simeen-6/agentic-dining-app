import { motion, AnimatePresence } from 'framer-motion'
import { Brain, MapPin, Star, Trophy, CalendarCheck, Check } from 'lucide-react'
import clsx from 'clsx'
import type { PipelineStep } from '../types/api'

interface StepConfig {
  key: PipelineStep
  label: string
  message: string
  Icon: React.ComponentType<{ className?: string }>
}

const STEPS: StepConfig[] = [
  { key: 'supervisor', label: 'Supervisor', message: 'Understanding your dining preferences...', Icon: Brain },
  { key: 'discovery', label: 'Discovery', message: 'Searching Google Places for restaurants...', Icon: MapPin },
  { key: 'enrich', label: 'Enrich', message: 'Reading reviews and checking hours...', Icon: Star },
  { key: 'recommendation', label: 'Recommend', message: 'Ranking restaurants for your taste...', Icon: Trophy },
  { key: 'reservation', label: 'Reservation', message: 'Preparing booking options...', Icon: CalendarCheck },
]

const STEP_ORDER: PipelineStep[] = [
  'supervisor',
  'discovery',
  'enrich',
  'recommendation',
  'reservation',
]

function getStepStatus(
  stepKey: PipelineStep,
  currentStep: PipelineStep,
): 'complete' | 'active' | 'future' {
  if (currentStep === 'complete' || currentStep === 'error') {
    return currentStep === 'complete' ? 'complete' : 'future'
  }
  const currentIdx = STEP_ORDER.indexOf(currentStep)
  const stepIdx = STEP_ORDER.indexOf(stepKey)
  if (stepIdx < currentIdx) return 'complete'
  if (stepIdx === currentIdx) return 'active'
  return 'future'
}

interface PipelineProgressProps {
  currentStep: PipelineStep
}

export function PipelineProgress({ currentStep }: PipelineProgressProps) {
  if (currentStep === 'idle') return null

  const allComplete = currentStep === 'complete'

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full max-w-3xl mx-auto"
    >
      {/* Mobile: vertical list */}
      <div className="flex flex-col gap-2 sm:hidden">
        {STEPS.map((step, i) => {
          const status = allComplete
            ? 'complete'
            : getStepStatus(step.key, currentStep)
          return (
            <MobileStep key={step.key} step={step} status={status} index={i} currentStep={currentStep} />
          )
        })}
      </div>

      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:flex items-start justify-between gap-0">
        {STEPS.map((step, i) => {
          const status = allComplete
            ? 'complete'
            : getStepStatus(step.key, currentStep)
          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0">
              <DesktopStep step={step} status={status} index={i} currentStep={currentStep} />
              {i < STEPS.length - 1 && (
                <div className="mt-5">
                  <Connector
                    filled={
                      status === 'complete' ||
                      (status === 'active' && i < STEPS.length - 1)
                    }
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

interface StepProps {
  step: StepConfig
  status: 'complete' | 'active' | 'future'
  index: number
  currentStep: PipelineStep
}

function DesktopStep({ step, status, index }: StepProps) {
  const { Icon, label, message } = step

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 px-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div className="relative">
        {/* Pulsing ring for active step */}
        {status === 'active' && (
          <motion.div
            className="absolute inset-0 rounded-full bg-brand-500/30"
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <motion.div
          className={clsx(
            'relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300',
            status === 'complete' &&
              'bg-brand-600 text-white',
            status === 'active' &&
              'bg-brand-600 text-white ring-2 ring-brand-300 dark:ring-brand-700',
            status === 'future' &&
              'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600',
          )}
          animate={
            status === 'active'
              ? { scale: [1, 1.05, 1] }
              : { scale: 1 }
          }
          transition={
            status === 'active'
              ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              : {}
          }
        >
          {status === 'complete' ? (
            <Check className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </motion.div>
      </div>

      <span
        className={clsx(
          'text-xs font-medium text-center whitespace-nowrap transition-colors duration-300',
          status === 'complete' && 'text-brand-600 dark:text-brand-400',
          status === 'active' && 'text-brand-700 dark:text-brand-300 font-semibold',
          status === 'future' && 'text-gray-400 dark:text-gray-600',
        )}
      >
        {label}
      </span>

      <AnimatePresence>
        {status === 'active' && (
          <motion.span
            key={`msg-${step.key}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-[10px] italic text-gray-400 dark:text-gray-500 text-center max-w-[100px] leading-tight"
          >
            {message}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function MobileStep({ step, status, index }: StepProps) {
  const { Icon, label, message } = step

  return (
    <motion.div
      className="flex items-start gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div className="relative shrink-0 mt-0.5">
        {status === 'active' && (
          <motion.div
            className="absolute inset-0 rounded-full bg-brand-500/30"
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div
          className={clsx(
            'relative w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300',
            status === 'complete' && 'bg-brand-600 text-white',
            status === 'active' &&
              'bg-brand-600 text-white ring-2 ring-brand-300 dark:ring-brand-700',
            status === 'future' &&
              'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600',
          )}
        >
          {status === 'complete' ? (
            <Check className="w-4 h-4" />
          ) : (
            <Icon className="w-4 h-4" />
          )}
        </div>
      </div>

      <div className="flex flex-col min-w-0">
        <span
          className={clsx(
            'text-sm font-medium transition-colors duration-300',
            status === 'complete' && 'text-brand-600 dark:text-brand-400',
            status === 'active' &&
              'text-brand-700 dark:text-brand-300 font-semibold',
            status === 'future' && 'text-gray-400 dark:text-gray-600',
          )}
        >
          {label}
        </span>

        <AnimatePresence>
          {status === 'active' && (
            <motion.span
              key={`msg-mobile-${step.key}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-xs italic text-gray-400 dark:text-gray-500 mt-0.5"
            >
              {message}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {status === 'active' && (
        <motion.div
          className="ml-auto shrink-0 mt-3"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
        </motion.div>
      )}
    </motion.div>
  )
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <div className="flex-1 h-0.5 mx-1 min-w-[12px]">
      <div
        className={clsx(
          'h-full rounded-full transition-colors duration-500',
          filled
            ? 'bg-brand-500'
            : 'bg-gray-200 dark:bg-gray-700',
        )}
      />
    </div>
  )
}
