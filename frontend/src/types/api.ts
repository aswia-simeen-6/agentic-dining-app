export interface Review {
  author_name: string
  author_url: string
  text: string
  rating: number
  relative_time: string
}

export interface Restaurant {
  place_id: string
  name: string
  address: string
  rating: number | null
  rating_count: number | null
  price_level: number | null // 1-4
  cuisine_types: string[]
  hours: string | null
  website: string | null
  phone: string | null
  photo_url: string | null
  reviews: Review[]
  lat: number | null
  lng: number | null
  menu_summary: string | null
}

export interface RankedRestaurant {
  place_id: string
  rank: number
  reason: string
}

export interface Recommendation {
  ranked: RankedRestaurant[]
  explanation: string
}

export interface Reservation {
  place_id: string
  name: string
  deep_link: string
  draft_message: string
}

export interface QueryResponse {
  session_id: string
  restaurants: Restaurant[]
  recommendation: Recommendation | null
  reservation: Reservation | null
  errors: string[]
  current_step: string
}

export type PipelineStep =
  | 'idle'
  | 'supervisor'
  | 'discovery'
  | 'enrich'
  | 'recommendation'
  | 'reservation'
  | 'complete'
  | 'error'

export interface StepEvent {
  type: 'step'
  step: 'supervisor' | 'discovery' | 'enrich' | 'recommendation' | 'reservation'
  data: Record<string, unknown>
}

export interface CompleteEvent {
  type: 'complete'
  data: QueryResponse
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type SSEEvent = StepEvent | CompleteEvent | ErrorEvent

export interface StreamCallbacks {
  onStep: (event: StepEvent) => void
  onComplete: (data: QueryResponse) => void
  onError: (message: string) => void
}
