import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CANT_EAT_LABELS, DONT_WANT_LABELS, BUDGET_LABELS } from '@/lib/utils'

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

interface RawRestaurant {
  name: string
  address: string
  category: string
  distance: string
  phone: string
  url: string
  lat: number
  lng: number
}

interface CategoryRecommendation {
  category: string
  menus: string[]
  matchCount: number
  totalCount: number
  restaurants: {
    name: string; address: string; distance: string
    phone: string; url: string; lat: number; lng: number
  }[]
}

// ─── 카테고리별 추천 메뉴 ────────────────────────────────────────────────────
const CATEGORY_MENUS: Record<string, string[]> = {
  한식:       ['된장찌개', '제육볶음', '비빔밥', '순두부찌개', '삼겹살', '갈비탕', '불고기', '칼국수'],
  일식:       ['라멘', '돈카츠', '우동', '규동', '오야코동', '스시', '나베', '소바'],
  중식:       ['짜장면', '짬뽕', '볶음밥', '탕수육', '마라탕', '깐풍기', '딤섬'],
  양식:       ['크림파스타', '피자', '스테이크', '리조또', '알리오올리오', '뇨끼'],
  분식:       ['떡볶이', '순대', '튀김', '김밥', '라볶이', '치즈떡볶이', '쫄면'],
  치킨:       ['후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭'],
  패스트푸드: ['버거', '감자튀김', '치킨너겟', '치즈버거'],
}

const RESTRICT_MENU_AVOID: Record<string, string[]> = {
  pork:       ['삼겹살', '제육볶음', '순대', '돈카츠'],
  seafood:    ['짬뽕', '나베', '스시', '소바'],
  chicken:    ['오야코동', '간장치킨', '양념치킨', '후라이드', '깐풍기', '치킨너겟', '파닭', '반반치킨'],
  beef:       ['불고기', '갈비탕', '규동', '스테이크'],
  vegetarian: ['삼겹살', '제육볶음', '돈카츠', '규동', '불고기', '갈비탕', '순대', '후라이드', '양념치킨', '깐풍기'],
  dairy:      ['크림파스타', '리조또', '치즈떡볶이', '뇨끼'],
  egg:        ['오야코동'],
  mushroom:   ['나베'],
  gluten:     ['라멘', '우동', '소바', '짜장면', '짬뽕'],
}

function pickMenus(category: string, cantEat: string[], count = 4): string[] {
  const all = CATEGORY_MENUS[category] ?? ['다양한 메뉴']
  const avoid = cantEat.flatMap(r => RESTRICT_MENU_AVOID[r] ?? [])
  const filtered = all.filter(m => !avoid.some(a => m.includes(a)))
  return (filtered.length > 0 ? filtered : all).slice(0, count)
}

// ─── 카카오 카테고리 정규화 ──────────────────────────────────────────────────
function normalizeCategory(rawCategory: string): string {
  if (/중국|중식/.test(rawCategory)) return '중식'
  if (/일식|일본|초밥|라멘|우동|돈카츠|사시미/.test(rawCategory)) return '일식'
  if (/양식|이탈리안|패밀리레스토랑|피자|파스타|스테이크/.test(rawCategory)) return '양식'
  if (/분식|떡볶이/.test(rawCategory)) return '분식'
  if (/치킨/.test(rawCategory)) return '치킨'
  if (/패스트푸드|햄버거/.test(rawCategory)) return '패스트푸드'
  if (/한식|한정식|국밥|해장국|삼겹살|갈비|설렁탕|백반/.test(rawCategory)) return '한식'
  return rawCategory.split('>').pop()?.trim() ?? rawCategory
}

// ─── Kakao 식당 검색 (2페이지, 최대 30개) ────────────────────────────────────
interface KakaoDoc {
  place_name: string; address_name: string; category_name: string
  distance: string; phone: string; place_url: string; x: string; y: string
}

async function searchKakao(lat: number, lng: number, locationText: string): Promise<{ restaurants: RawRestaurant[]; isDummy: boolean }> {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
  if (!key) return { restaurants: dummyRestaurants(locationText), isDummy: true }

  try {
    const hasGps = lat !== 37.5665 || lng !== 126.9780
    const useKeyword = !!locationText || !hasGps
    let allDocs: KakaoDoc[] = []

    if (useKeyword) {
      const base = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent((locationText || '서울') + ' 음식점')}&size=15`
      const [r1, r2, r3] = await Promise.all([
        fetch(`${base}&page=1`, { headers: { Authorization: `KakaoAK ${key}` } }),
        fetch(`${base}&page=2`, { headers: { Authorization: `KakaoAK ${key}` } }),
        fetch(`${base}&page=3`, { headers: { Authorization: `KakaoAK ${key}` } }),
      ])
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()])
      allDocs = [...(d1.documents ?? []), ...(d2.documents ?? []), ...(d3.documents ?? [])]
    } else {
      const r = await fetch(
        `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6&x=${lng}&y=${lat}&radius=1000&sort=distance&size=15`,
        { headers: { Authorization: `KakaoAK ${key}` } }
      )
      const d = await r.json()
      allDocs = d.documents ?? []
    }

    if (!allDocs.length) return { restaurants: dummyRestaurants(locationText), isDummy: true }

    const seen = new Set<string>()
    const restaurants = allDocs
      .filter(d => { if (seen.has(d.place_name)) return false; seen.add(d.place_name); return true })
      .map(d => ({
        name: d.place_name,
        address: d.address_name,
        category: normalizeCategory(d.category_name),
        distance: d.distance || '',
        phone: d.phone,
        url: d.place_url,
        lat: parseFloat(d.y),
        lng: parseFloat(d.x),
      }))
    return { restaurants, isDummy: false }
  } catch {
    return { restaurants: dummyRestaurants(locationText), isDummy: true }
  }
}

function dummyRestaurants(location: string): RawRestaurant[] {
  const area = location || '근처'
  const b = { phone: '', url: '', lat: 37.5665, lng: 126.9780 }
  return [
    { name: '진이찬방',    address: area, category: '한식',       distance: '150', ...b },
    { name: '연세칼국수',  address: area, category: '한식',       distance: '280', ...b },
    { name: '스시히로',    address: area, category: '일식',       distance: '220', ...b },
    { name: '멘야마루',    address: area, category: '일식',       distance: '450', ...b },
    { name: '홍콩반점',    address: area, category: '중식',       distance: '310', ...b },
    { name: '파스타베네',  address: area, category: '양식',       distance: '400', ...b },
    { name: '한촌설렁탕',  address: area, category: '한식',       distance: '480', ...b },
    { name: '마루초밥',    address: area, category: '일식',       distance: '540', ...b },
    { name: '엽기떡볶이',  address: area, category: '분식',       distance: '600', ...b },
    { name: '굽네치킨',    address: area, category: '치킨',       distance: '650', ...b },
    { name: '본죽&비빔밥', address: area, category: '한식',       distance: '720', ...b },
    { name: '맥도날드',    address: area, category: '패스트푸드', distance: '800', ...b },
  ]
}

// ─── 카테고리별 그룹핑 ───────────────────────────────────────────────────────
const DISLIKE_TO_CATEGORY: Record<string, string[]> = {
  korean: ['한식'], chinese: ['중식'], japanese: ['일식'],
  western: ['양식'], bunsik: ['분식'], meat: ['치킨'], fastfood: ['패스트푸드'],
}

function groupByCategory(
  participants: ParticipantRow[],
  restaurants: RawRestaurant[],
  allCantEat: string[]
): CategoryRecommendation[] {
  const byCategory: Record<string, RawRestaurant[]> = {}
  for (const r of restaurants) {
    const cat = r.category || '기타'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(r)
  }

  const result: CategoryRecommendation[] = []
  for (const [category, rests] of Object.entries(byCategory)) {
    const matchCount = participants.filter(p =>
      !(p.dont_want ?? []).some(d => (DISLIKE_TO_CATEGORY[d] ?? []).includes(category))
    ).length

    const sorted = [...rests].sort((a, b) => {
      const da = parseInt(a.distance) || 0
      const db = parseInt(b.distance) || 0
      return da !== db ? da - db : Math.random() - 0.5
    })

    result.push({
      category,
      menus: pickMenus(category, allCantEat, 4),
      matchCount,
      totalCount: participants.length,
      restaurants: sorted.map(r => ({
        name: r.name, address: r.address, distance: r.distance,
        phone: r.phone, url: r.url, lat: r.lat, lng: r.lng,
      })),
    })
  }

  result.sort((a, b) =>
    b.matchCount !== a.matchCount ? b.matchCount - a.matchCount :
    b.restaurants.length - a.restaurants.length
  )

  return result
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
    const withGps = participants.filter(p => p.lat && p.lng)
    const lat = withGps.length > 0
      ? withGps.reduce((s: number, p: ParticipantRow) => s + (p.lat ?? 0), 0) / withGps.length
      : 37.5665
    const lng = withGps.length > 0
      ? withGps.reduce((s: number, p: ParticipantRow) => s + (p.lng ?? 0), 0) / withGps.length
      : 126.9780

    const { restaurants: rawRestaurants, isDummy } = await searchKakao(lat, lng, locationText)
    const allCantEat = Array.from(new Set(participants.flatMap((p: { cant_eat?: string[] }) => p.cant_eat ?? [])))
    const recommendations = groupByCategory(participants, rawRestaurants, allCantEat)

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
