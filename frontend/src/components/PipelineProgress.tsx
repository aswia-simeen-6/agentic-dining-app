import { motion } from 'framer-motion'
import { Brain, MapPin, Star, Trophy, CalendarCheck, Check } from 'lucide-react'
import clsx from 'clsx'
import type { PipelineStep } from '../types/api'

interface StepConfig {
  key: PipelineStep
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const STEPS: StepConfig[] = [
  { key: 'supervisor', label: 'Supervisor', Icon: Brain },
  { key: 'discovery', label: 'Discovery', Icon: MapPin },
  { key: 'enrich', label: 'Enrich', Icon: Star },
  { key: 'recommendation', label: 'Recommend', Icon: Trophy },
  { key: 'reservation', label: 'Reservation', Icon: CalendarCheck },
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
            <MobileStep key={step.key} step={step} status={status} index={i} />
          )
        })}
      </div>

      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:flex items-center justify-between gap-0">
        {STEPS.map((step, i) => {
          const status = allComplete
            ? 'complete'
            : getStepStatus(step.key, currentStep)
          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <DesktopStep step={step} status={status} index={i} />
              {i < STEPS.length - 1 && (
                <Connector
                  filled={
                    status === 'complete' ||
                    (status === 'active' && i < STEPS.length - 1)
                  }
                />
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
}

function DesktopStep({ step, status, index }: StepProps) {
  const { Icon, label } = step

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
    </motion.div>
  )
}

function MobileStep({ step, status, index }: StepProps) {
  const { Icon, label } = step

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div className="relative shrink-0">
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

      {status === 'active' && (
        <motion.div
          className="ml-auto"
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
