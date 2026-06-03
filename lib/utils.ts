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

// ─── 못 먹는 것 ──────────────────────────────────────────────────────────────
export const CANT_EAT_OPTIONS = [
  // 육류·해산물
  { id: 'pork',       label: '돼지고기' },
  { id: 'beef',       label: '소고기' },
  { id: 'chicken',    label: '닭고기' },
  { id: 'seafood',    label: '해산물' },
  // 식이 제한
  { id: 'vegetarian', label: '채식' },
  { id: 'dairy',      label: '유제품' },
  { id: 'gluten',     label: '밀가루' },
  { id: 'egg',        label: '계란' },
  // 특정 식재료
  { id: 'nuts',       label: '견과류' },
  { id: 'mushroom',   label: '버섯' },
]
// 가지·오이·고수·마늘·양파는 메뉴 단위 필터링이 어려워 제외 → 기타 직접 입력 사용

// ─── 오늘 먹기 싫은 것 ───────────────────────────────────────────────────────
export const DONT_WANT_OPTIONS = [
  { id: 'korean',   label: '한식' },
  { id: 'chinese',  label: '중식' },
  { id: 'japanese', label: '일식' },
  { id: 'western',  label: '양식' },
  { id: 'bunsik',   label: '분식' },
  { id: 'asian',    label: '동남아' },
  { id: 'barbeque', label: '고기구이/치킨' },
  { id: 'fastfood', label: '패스트푸드' },
]

// ─── 예산 ────────────────────────────────────────────────────────────────────
export const BUDGET_OPTIONS = [
  { id: 'any',       label: '상관없어요' },
  { id: 'under_10k', label: '1만원 이하' },
  { id: '10k_20k',   label: '1~2만원' },
  { id: 'over_20k',  label: '2만원 이상' },
]

// ─── 레이블 맵 ───────────────────────────────────────────────────────────────
export const CANT_EAT_LABELS: Record<string, string> = {
  pork: '돼지고기', beef: '소고기', chicken: '닭고기', seafood: '해산물',
  vegetarian: '채식', dairy: '유제품', gluten: '밀가루', egg: '계란',
  nuts: '견과류', mushroom: '버섯',
}

export const DONT_WANT_LABELS: Record<string, string> = {
  korean: '한식', chinese: '중식', japanese: '일식', western: '양식',
  bunsik: '분식', asian: '동남아', barbeque: '고기구이/치킨', fastfood: '패스트푸드',
}

export const BUDGET_LABELS: Record<string, string> = {
  any: '상관없어요', under_10k: '1만원 이하', '10k_20k': '1~2만원', over_20k: '2만원 이상',
}
