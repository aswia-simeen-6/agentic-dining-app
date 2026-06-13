import type { QueryResponse, StreamCallbacks } from '../types/api'

const API_KEY = import.meta.env.VITE_API_KEY ?? 'dev-key'
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export async function fetchStoredResults(sessionId: string): Promise<QueryResponse> {
  const res = await fetch(`${BASE_URL}/api/results/${sessionId}`, {
    headers: { 'X-API-Key': API_KEY },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<QueryResponse>
}

export async function queryBlocking(
  query: string,
  sessionId: string,
): Promise<QueryResponse> {
  const res = await fetch(`${BASE_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ query, session_id: sessionId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<QueryResponse>
}

/**
 * Opens an SSE stream via fetch (not EventSource) so we can send X-API-Key header.
 * EventSource does not support custom headers — fetch + ReadableStream does.
 * Returns a cleanup function that aborts the stream.
 */
export function queryStream(
  query: string,
  sessionId: string,
  callbacks: StreamCallbacks,
): () => void {
  const params = new URLSearchParams({ query, session_id: sessionId })
  const url = `${BASE_URL}/api/query/stream?${params.toString()}`
  const controller = new AbortController()

  async function run() {
    let res: Response
    try {
      res = await fetch(url, {
        headers: { 'X-API-Key': API_KEY },
        signal: controller.signal,
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError('Failed to connect to server.')
      }
      return
    }

    if (!res.ok || !res.body) {
      callbacks.onError(`Server error ${res.status}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines: "data: {...}\n\n"
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const jsonStr = trimmed.slice(5).trim()
          if (!jsonStr) continue

          let parsed: unknown
          try {
            parsed = JSON.parse(jsonStr)
          } catch {
            continue
          }

          if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) continue
          const ev = parsed as { type: string }

          if (ev.type === 'step') {
            const stepEv = ev as {
              type: 'step'
              step: 'supervisor' | 'discovery' | 'enrich' | 'recommendation' | 'reservation'
              data: Record<string, unknown>
            }
            callbacks.onStep({ type: 'step', step: stepEv.step, data: stepEv.data })
          } else if (ev.type === 'complete') {
            const completeEv = ev as { type: 'complete'; data?: QueryResponse }
            if (completeEv.data) {
              callbacks.onComplete(completeEv.data)
            } else {
              callbacks.onError('Pipeline completed with no data.')
            }
            controller.abort()
            return
          } else if (ev.type === 'error') {
            const errorEv = ev as { type: 'error'; message: string }
            callbacks.onError(errorEv.message)
            controller.abort()
            return
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError('Stream interrupted. Please try again.')
      }
    }
  }

  void run()

  return () => controller.abort()
}
