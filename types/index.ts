export interface Room {
  code: string
  host_name: string
  status: 'waiting' | 'recommending' | 'results'
  recommendations: Restaurant[] | null
  created_at: string
}

export interface Participant {
  id: string
  room_code: string
  name: string
  cant_eat: string[]
  dont_want: string[]
  budget: string
  lat: number | null
  lng: number | null
  completed: boolean
  created_at: string
}

export interface Vote {
  id: string
  room_code: string
  participant_name: string
  restaurant_name: string
  vote: 'ok' | 'no'
  created_at: string
}

export interface Restaurant {
  name: string
  distance: string
  category: string
  matchCount: number
  totalCount: number
  reason: string
  address: string
  phone?: string
  url?: string
  lat?: number
  lng?: number
}
