export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function formatDistance(distance: string | number): string {
  const d = parseInt(distance.toString())
  if (isNaN(d)) return String(distance)
  return d < 1000 ? `${d}m` : `${(d / 1000).toFixed(1)}km`
}

export const CANT_EAT_OPTIONS = [
  { id: 'pork',       label: '돼지고기' },
  { id: 'seafood',    label: '해산물' },
  { id: 'chicken',    label: '닭고기' },
  { id: 'beef',       label: '소고기' },
  { id: 'vegetarian', label: '채식' },
  { id: 'dairy',      label: '유제품' },
  { id: 'gluten',     label: '밀가루' },
  { id: 'nuts',       label: '견과류' },
  { id: 'egg',        label: '계란' },
]

export const DONT_WANT_OPTIONS = [
  { id: 'korean',   label: '한식' },
  { id: 'chinese',  label: '중식' },
  { id: 'japanese', label: '일식' },
  { id: 'western',  label: '양식' },
  { id: 'bunsik',   label: '분식' },
  { id: 'meat',     label: '고기류' },
  { id: 'soup',     label: '국물류' },
  { id: 'fastfood', label: '패스트푸드' },
]

export const BUDGET_OPTIONS = [
  { id: 'under_10k', label: '1만원 이하' },
  { id: '10k_20k',   label: '1~2만원' },
  { id: 'over_20k',  label: '2만원 이상' },
]

export const SPICY_OPTIONS = [
  { id: 'no',     label: '🥛 못 먹어요' },
  { id: 'normal', label: '🌶️ 보통이에요' },
  { id: 'yes',    label: '🔥 잘 먹어요' },
]

export const MOOD_OPTIONS = [
  { id: 'quick',   label: '⚡ 빠르게 먹고 싶어요' },
  { id: 'relaxed', label: '😌 여유롭게 먹고 싶어요' },
  { id: 'any',     label: '🤷 상관없어요' },
]

export const CRAVING_OPTIONS = [
  { id: '',         label: '없음 (상관없어요)' },
  { id: 'korean',   label: '🍲 한식이 땡겨요' },
  { id: 'chinese',  label: '🥡 중식이 땡겨요' },
  { id: 'japanese', label: '🍱 일식이 땡겨요' },
  { id: 'western',  label: '🍝 양식이 땡겨요' },
  { id: 'bunsik',   label: '🥚 분식이 땡겨요' },
]

export const CANT_EAT_LABELS: Record<string, string> = {
  pork: '돼지고기', seafood: '해산물', chicken: '닭고기',
  beef: '소고기', vegetarian: '채식', dairy: '유제품',
  gluten: '밀가루', nuts: '견과류', egg: '계란',
}

export const DONT_WANT_LABELS: Record<string, string> = {
  korean: '한식', chinese: '중식', japanese: '일식',
  western: '양식', bunsik: '분식', meat: '고기류',
  soup: '국물류', fastfood: '패스트푸드',
}

export const BUDGET_LABELS: Record<string, string> = {
  under_10k: '1만원 이하', '10k_20k': '1~2만원', over_20k: '2만원 이상',
}

export const SPICY_LABELS: Record<string, string> = {
  no: '매운 거 못 먹음', normal: '보통', yes: '매운 거 잘 먹음',
}

export const MOOD_LABELS: Record<string, string> = {
  quick: '빠르게', relaxed: '여유롭게', any: '상관없음',
}

export const CRAVING_LABELS: Record<string, string> = {
  '': '없음', korean: '한식', chinese: '중식',
  japanese: '일식', western: '양식', bunsik: '분식',
}
