import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ParticipantRow {
  name: string
  cant_eat: string[]
  dont_want: string[]
  budget: string
  lat: number | null
  lng: number | null
}

interface KakaoDoc {
  place_name: string; address_name: string; category_name: string
  distance: string; phone: string; place_url: string; x: string; y: string
}

interface RestaurantItem {
  name: string; address: string; distance: string
  phone?: string; url?: string; lat?: number; lng?: number
}

interface MenuRecommendation {
  name: string
  restaurants: RestaurantItem[]
}

interface CategoryRecommendation {
  category: string
  menus: MenuRecommendation[]
  matchCount: number
  totalCount: number
}

// ─── 카테고리별 메뉴 (확장) ────────────────────────────────────────────────────
const CATEGORY_MENUS: Record<string, string[]> = {
  한식:       ['된장찌개', '제육볶음', '비빔밥', '순두부찌개', '삼겹살', '갈비탕', '불고기', '칼국수',
               '김치찌개', '닭갈비', '쌈밥', '냉면', '육개장', '해장국'],
  일식:       ['라멘', '돈카츠', '우동', '규동', '오야코동', '스시', '나베', '소바',
               '야키토리', '텐동', '히레카츠', '새우튀김덮밥'],
  중식:       ['짜장면', '짬뽕', '볶음밥', '탕수육', '마라탕', '깐풍기', '딤섬',
               '마라샹궈', '양꼬치', '훠궈'],
  양식:       ['크림파스타', '피자', '스테이크', '리조또', '알리오올리오', '뇨끼',
               '토마토파스타', '샐러드', '브런치'],
  분식:       ['떡볶이', '순대', '튀김', '김밥', '라볶이', '치즈떡볶이', '쫄면',
               '핫도그', '어묵탕', '만두'],
  치킨:       ['후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭',
               '마늘치킨', '뿌링클', '허니콤보'],
  패스트푸드: ['버거', '감자튀김', '치킨너겟', '치즈버거', '샌드위치', '랩'],
  요리주점:   ['파전', '모듬전', '닭볶음탕', '두루치기', '해물파전', '감자전', '보쌈', '족발'],
}

// ─── 예산별 허용 카테고리 ─────────────────────────────────────────────────────
const BUDGET_ALLOWED_CATEGORIES: Record<string, string[]> = {
  under_10k: ['한식', '분식', '패스트푸드', '치킨'],
  '10k_20k': ['한식', '일식', '중식', '양식', '분식', '치킨', '패스트푸드'],
  over_20k:  ['한식', '일식', '중식', '양식', '요리주점'],
  any:       Object.keys(CATEGORY_MENUS),
}
const BUDGET_RANK: Record<string, number> = {
  under_10k: 1, '10k_20k': 2, over_20k: 3, any: 99,
}

const RESTRICT_MENU_AVOID: Record<string, string[]> = {
  pork:       ['삼겹살', '제육볶음', '순대', '돈카츠', '두루치기', '김치찌개', '쌈밥',
               '해장국', '핫도그', '만두', '보쌈', '족발'],
  seafood:    ['짬뽕', '나베', '스시', '소바', '해물파전', '텐동', '새우튀김덮밥', '어묵탕'],
  chicken:    ['오야코동', '간장치킨', '양념치킨', '후라이드', '깐풍기', '치킨너겟', '파닭',
               '반반치킨', '닭볶음탕', '닭갈비', '야키토리', '마늘치킨', '뿌링클', '허니콤보'],
  beef:       ['불고기', '갈비탕', '규동', '스테이크', '냉면', '육개장', '해장국', '양꼬치'],
  vegetarian: ['삼겹살', '제육볶음', '돈카츠', '규동', '불고기', '갈비탕', '순대', '후라이드',
               '양념치킨', '깐풍기', '닭볶음탕', '두루치기', '오야코동', '치킨너겟', '간장치킨',
               '반반치킨', '파닭', '김치찌개', '닭갈비', '야키토리', '마늘치킨', '뿌링클', '허니콤보',
               '보쌈', '족발', '양꼬치'],
  dairy:      ['크림파스타', '리조또', '치즈떡볶이', '뇨끼', '뿌링클', '브런치'],
  egg:        ['오야코동', '텐동', '브런치'],
  mushroom:   ['나베'],
  gluten:     ['라멘', '우동', '소바', '짜장면', '짬뽕', '칼국수', '돈카츠', '크림파스타',
               '알리오올리오', '뇨끼', '피자', '토마토파스타', '샌드위치', '핫도그', '만두',
               '랩', '어묵탕', '히레카츠'],
  nuts:       [],
}

// ─── 먹기 싫은 것 → 메뉴 필터 ─────────────────────────────────────────────────
const DONT_WANT_MENU_AVOID: Record<string, string[]> = {
  barbeque: ['삼겹살', '제육볶음', '갈비탕', '불고기', '돈카츠', '규동', '스테이크',
             '후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭', '오야코동',
             '닭볶음탕', '두루치기', '치킨너겟', '닭갈비', '야키토리', '보쌈', '족발',
             '양꼬치', '마늘치킨', '뿌링클', '허니콤보'],
  soup: ['된장찌개', '순두부찌개', '갈비탕', '칼국수', '라멘', '우동', '짬뽕', '나베',
         '김치찌개', '육개장', '해장국', '훠궈'],
}

const DISLIKE_TO_CATEGORY: Record<string, string[]> = {
  korean: ['한식'], chinese: ['중식'], japanese: ['일식'],
  western: ['양식'], bunsik: ['분식'], barbeque: ['치킨', '요리주점'], fastfood: ['패스트푸드'],
}

// ─── 유틸: 무작위 샘플링 ──────────────────────────────────────────────────────
function shuffleAndPick<T>(arr: T[], n: number): T[] {
  const shuffled = arr.slice().sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

function pickMenus(category: string, cantEat: string[], dontWant: string[] = []): string[] {
  const all = CATEGORY_MENUS[category] ?? ['다양한 메뉴']
  const avoid = [
    ...cantEat.flatMap(r => RESTRICT_MENU_AVOID[r] ?? []),
    ...dontWant.flatMap(d => DONT_WANT_MENU_AVOID[d] ?? []),
  ]
  const filtered = all.filter(m => !avoid.some(a => m.includes(a)))
  const pool = filtered.length > 0 ? filtered : all
  // 카테고리당 최대 5개 랜덤 선택 → API 호출 수 감소 + 매 세션마다 다른 메뉴
  return shuffleAndPick(pool, 5)
}

// ─── 메뉴별 카카오 키워드 검색 ────────────────────────────────────────────────
async function searchMenuRestaurants(key: string, query: string): Promise<RestaurantItem[]> {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`,
      { headers: { Authorization: `KakaoAK ${key}` } }
    )
    const data = await res.json()
    return (data.documents ?? []).map((d: KakaoDoc) => ({
      name: d.place_name,
      address: d.address_name,
      distance: d.distance || '',
      phone: d.phone,
      url: d.place_url,
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
    }))
  } catch { return [] }
}

// ─── 더미 데이터 (API 키 없을 때) ─────────────────────────────────────────────
const DUMMY_BY_CATEGORY: Record<string, RestaurantItem[]> = {
  한식: [
    { name: '진이찬방',    address: '근처', distance: '150', phone: '', url: '', lat: 37.5665, lng: 126.9780 },
    { name: '연세칼국수',  address: '근처', distance: '280', phone: '', url: '', lat: 37.5665, lng: 126.9780 },
    { name: '한촌설렁탕',  address: '근처', distance: '480', phone: '', url: '', lat: 37.5665, lng: 126.9780 },
    { name: '본죽&비빔밥', address: '근처', distance: '720', phone: '', url: '', lat: 37.5665, lng: 126.9780 },
  ],
  일식: [
    { name: '스시히로', address: '근처', distance: '220', phone: '', url: '', lat: 37.5665, lng: 126.9780 },
    { name: '멘야마루', address: '근처', distance: '450', phone: '', url: '', lat: 37.5665, lng: 126.9780 },
    { name: '마루초밥', address: '근처', distance: '540', phone: '', url: '', lat: 37.5665, lng: 126.9780 },
  ],
  중식:       [{ name: '홍콩반점',   address: '근처', distance: '310', phone: '', url: '', lat: 37.5665, lng: 126.9780 }],
  양식:       [{ name: '파스타베네', address: '근처', distance: '400', phone: '', url: '', lat: 37.5665, lng: 126.9780 }],
  분식:       [{ name: '엽기떡볶이', address: '근처', distance: '600', phone: '', url: '', lat: 37.5665, lng: 126.9780 }],
  치킨:       [{ name: '굽네치킨',   address: '근처', distance: '650', phone: '', url: '', lat: 37.5665, lng: 126.9780 }],
  패스트푸드: [{ name: '맥도날드',   address: '근처', distance: '800', phone: '', url: '', lat: 37.5665, lng: 126.9780 }],
  요리주점:   [{ name: '맛있는주점', address: '근처', distance: '500', phone: '', url: '', lat: 37.5665, lng: 126.9780 }],
}

// ─── API Route ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { room_code } = await req.json()
  if (!room_code) return NextResponse.json({ error: '방 코드가 없습니다' }, { status: 400 })

  await supabase.from('rooms').update({ status: 'recommending' }).eq('code', room_code)

  try {
    const [{ data: roomData }, { data: participants, error: pErr }] = await Promise.all([
      supabase.from('rooms').select('location').eq('code', room_code).single(),
      supabase.from('participants').select('*').eq('room_code', room_code).eq('completed', true),
    ])

    if (pErr) throw pErr
    if (!participants?.length) {
      await supabase.from('rooms').update({ status: 'waiting' }).eq('code', room_code)
      return NextResponse.json({ error: '참여자가 없습니다' }, { status: 400 })
    }

    const locationText = roomData?.location ?? ''
    const allCantEat = Array.from(new Set(participants.flatMap((p: { cant_eat?: string[] }) => p.cant_eat ?? [])))
    const allDontWant = Array.from(new Set(participants.flatMap((p: { dont_want?: string[] }) => p.dont_want ?? [])))

    // ── 예산 합의: 가장 제한적인 예산 기준으로 카테고리 필터 ──────────────────
    const budgets = participants
      .map((p: ParticipantRow) => p.budget)
      .filter((b: string) => b && b !== 'any')
    const consensusBudget = budgets.length > 0
      ? (budgets as string[]).reduce((min: string, b: string) =>
          (BUDGET_RANK[b] ?? 99) < (BUDGET_RANK[min] ?? 99) ? b : min
        )
      : 'any'
    const allowedCategories = new Set<string>(
      BUDGET_ALLOWED_CATEGORIES[consensusBudget] ?? Object.keys(CATEGORY_MENUS)
    )

    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY

    // 카테고리별 메뉴 검색 태스크 생성 (예산 + cant_eat + dont_want 모두 반영)
    type SearchTask = { category: string; menu: string }
    const tasks: SearchTask[] = []
    for (const category of Object.keys(CATEGORY_MENUS)) {
      if (!allowedCategories.has(category)) continue  // 예산 외 카테고리 제외
      const menus = pickMenus(category, allCantEat, allDontWant)
      for (const menu of menus) {
        tasks.push({ category, menu })
      }
    }

    let isDummy = false
    let menuResults: RestaurantItem[][]

    if (key) {
      menuResults = await Promise.all(
        tasks.map(t =>
          searchMenuRestaurants(key, locationText ? `${locationText} ${t.menu}` : t.menu)
        )
      )
    } else {
      isDummy = true
      menuResults = tasks.map(t => DUMMY_BY_CATEGORY[t.category] ?? [])
    }

    // 결과를 CategoryRecommendation[] 형태로 조립
    const categoryMap: Record<string, MenuRecommendation[]> = {}
    tasks.forEach((task, i) => {
      if (!categoryMap[task.category]) categoryMap[task.category] = []
      categoryMap[task.category].push({ name: task.menu, restaurants: menuResults[i] })
    })

    const recommendations: CategoryRecommendation[] = Object.entries(categoryMap)
      .map(([category, menus]) => ({
        category,
        menus,
        matchCount: participants.filter((p: ParticipantRow) =>
          !(p.dont_want ?? []).some((d: string) => (DISLIKE_TO_CATEGORY[d] ?? []).includes(category))
        ).length,
        totalCount: participants.length,
      }))
      .sort((a, b) =>
        b.matchCount !== a.matchCount ? b.matchCount - a.matchCount :
        b.menus.flatMap(m => m.restaurants).length - a.menus.flatMap(m => m.restaurants).length
      )

    const { error: uErr } = await supabase
      .from('rooms').update({ recommendations, status: 'results' }).eq('code', room_code)
    if (uErr) throw uErr

    return NextResponse.json({ recommendations, isDummy })
  } catch (e: unknown) {
    console.error('Recommend error:', e)
    await supabase.from('rooms').update({ status: 'waiting' }).eq('code', room_code)
    return NextResponse.json({ error: '추천에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
