import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchStoredResults, queryStream } from '../lib/api'
import type {
  PipelineStep,
  QueryResponse,
  Recommendation,
  Reservation,
  Restaurant,
} from '../types/api'

interface PipelineState {
  query: string
  sessionId: string
  currentStep: PipelineStep
  restaurants: Restaurant[]
  recommendation: Recommendation | null
  reservation: Reservation | null
  errors: string[]
  isStreaming: boolean
  shareUrl: string | null
}

const initialState: PipelineState = {
  query: '',
  sessionId: '',
  currentStep: 'idle',
  restaurants: [],
  recommendation: null,
  reservation: null,
  errors: [],
  isStreaming: false,
  shareUrl: null,
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>(initialState)

  // Ref to the SSE cleanup function so cancel() can close it from anywhere
  const closeStreamRef = useRef<(() => void) | null>(null)

  // On mount: check if URL matches /r/:sessionId and load stored results
  useEffect(() => {
    const match = /^\/r\/([^/?#]+)/.exec(window.location.pathname)
    if (!match) return
    const sessionId = match[1]

    void fetchStoredResults(sessionId)
      .then((data: QueryResponse) => {
        setState((prev) => ({
          ...prev,
          sessionId,
          currentStep: 'complete',
          isStreaming: false,
          restaurants: data.restaurants,
          recommendation: data.recommendation,
          reservation: data.reservation,
          errors: data.errors,
          shareUrl: `${window.location.origin}/r/${sessionId}`,
        }))
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load shared results.'
        setState((prev) => ({
          ...prev,
          currentStep: 'error',
          errors: [...prev.errors, msg],
        }))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitQuery = useCallback((query: string) => {
    // Close any existing stream before starting a new one
    if (closeStreamRef.current) {
      closeStreamRef.current()
      closeStreamRef.current = null
    }

    const sessionId = generateSessionId()

    setState({
      ...initialState,
      query,
      sessionId,
      currentStep: 'supervisor',
      isStreaming: true,
    })

    const close = queryStream(query, sessionId, {
      onStep(event) {
        setState((prev) => ({
          ...prev,
          currentStep: event.step as PipelineStep,
          // Merge partial data as steps arrive
          ...(event.step === 'discovery' &&
          typeof event.data === 'object' &&
          event.data !== null &&
          'restaurants' in event.data
            ? { restaurants: event.data.restaurants as Restaurant[] }
            : {}),
          ...(event.step === 'recommendation' &&
          typeof event.data === 'object' &&
          event.data !== null &&
          'recommendation' in event.data
            ? { recommendation: event.data.recommendation as Recommendation }
            : {}),
          ...(event.step === 'reservation' &&
          typeof event.data === 'object' &&
          event.data !== null &&
          'reservation' in event.data
            ? { reservation: event.data.reservation as Reservation }
            : {}),
        }))
      },

      onComplete(data: QueryResponse) {
        closeStreamRef.current = null
        setState((prev) => ({
          ...prev,
          currentStep: 'complete',
          isStreaming: false,
          restaurants: data.restaurants,
          recommendation: data.recommendation,
          reservation: data.reservation,
          errors: data.errors,
          shareUrl: `${window.location.origin}/r/${sessionId}`,
        }))
      },

      onError(message: string) {
        closeStreamRef.current = null
        setState((prev) => ({
          ...prev,
          currentStep: 'error',
          isStreaming: false,
          errors: [...prev.errors, message],
        }))
      },
    })

    closeStreamRef.current = close
  }, [])

  const cancel = useCallback(() => {
    if (closeStreamRef.current) {
      closeStreamRef.current()
      closeStreamRef.current = null
    }
    setState((prev) => ({
      ...prev,
      currentStep: prev.currentStep === 'idle' ? 'idle' : 'idle',
      isStreaming: false,
    }))
  }, [])

  const reset = useCallback(() => {
    if (closeStreamRef.current) {
      closeStreamRef.current()
      closeStreamRef.current = null
    }
    setState(initialState)
  }, [])

  const dismissError = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      errors: prev.errors.filter((_, i) => i !== index),
    }))
  }, [])

  return {
    // State
    query: state.query,
    sessionId: state.sessionId,
    currentStep: state.currentStep,
    restaurants: state.restaurants,
    recommendation: state.recommendation,
    reservation: state.reservation,
    errors: state.errors,
    isStreaming: state.isStreaming,
    shareUrl: state.shareUrl,
    // Actions
    submitQuery,
    cancel,
    reset,
    dismissError,
  }
}
