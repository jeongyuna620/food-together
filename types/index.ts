export interface Room {
  code: string
  host_name: string
  location: string
  status: 'waiting' | 'recommending' | 'results'
  recommendations: CategoryRecommendation[] | null
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

export interface RestaurantItem {
  name: string
  address: string
  distance: string
  phone?: string
  url?: string
  lat?: number
  lng?: number
}

export interface MenuRecommendation {
  name: string
  restaurants: RestaurantItem[]
}

export interface CategoryRecommendation {
  category: string
  menus: MenuRecommendation[]
  matchCount: number
  totalCount: number
}
