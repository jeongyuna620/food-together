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

// ─── 카테고리별 메뉴 (풀 확장 — 재추천 다양성 확보) ──────────────────────────────
const CATEGORY_MENUS: Record<string, string[]> = {
  한식: [
    '된장찌개', '제육볶음', '비빔밥', '순두부찌개', '삼겹살', '갈비탕', '불고기', '칼국수',
    '김치찌개', '닭갈비', '쌈밥', '냉면', '육개장', '해장국',
    '설렁탕', '갈비찜', '보쌈', '족발', '순대국밥', '닭한마리', '감자탕', '해물탕', '삼계탕',
  ],
  일식: [
    '라멘', '돈카츠', '우동', '규동', '오야코동', '스시', '나베', '소바',
    '야키토리', '텐동', '히레카츠', '새우튀김덮밥',
    '가라아게', '타코야키', '오코노미야키', '스키야키', '카레라이스',
  ],
  중식: [
    '짜장면', '짬뽕', '볶음밥', '탕수육', '마라탕', '깐풍기', '딤섬',
    '마라샹궈', '양꼬치', '훠궈',
    '꿔바로우', '팔보채', '마파두부',
  ],
  양식: [
    '크림파스타', '피자', '스테이크', '리조또', '알리오올리오', '뇨끼',
    '토마토파스타', '샐러드', '브런치',
    '함박스테이크', '카르보나라', '봉골레',
  ],
  분식: [
    '떡볶이', '순대', '튀김', '김밥', '라볶이', '치즈떡볶이', '쫄면',
    '핫도그', '어묵탕', '만두',
    '볶음우동', '마약김밥', '돈가스', '오뎅국물',
  ],
  치킨: [
    '후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭',
    '마늘치킨', '뿌링클', '허니콤보',
    '순살치킨', '닭강정', '매운치킨',
  ],
  패스트푸드: [
    '버거', '감자튀김', '치킨너겟', '치즈버거', '샌드위치', '랩',
    '타코', '부리토',
  ],
  동남아: [
    '쌀국수', '팟타이', '반미', '분짜', '나시고렝', '똠얌', '반쎄오',
  ],
}

const RESTRICT_MENU_AVOID: Record<string, string[]> = {
  pork: [
    '삼겹살', '제육볶음', '순대', '돈카츠', '두루치기', '김치찌개', '쌈밥',
    '해장국', '핫도그', '만두', '보쌈', '족발',
    '순대국밥', '감자탕', '돈가스', '꿔바로우', '카르보나라',
    '히레카츠', '마파두부', '오코노미야키',
    '반미', '분짜',   // 돼지고기 포함
  ],
  seafood: [
    '짬뽕', '나베', '스시', '소바', '해물파전', '텐동', '새우튀김덮밥', '어묵탕',
    '해물탕', '봉골레', '팔보채', '오뎅국물', '오코노미야키', '타코야키',
    '팟타이', '똠얌', '반쎄오', '쌀국수',   // 새우/해산물 포함
  ],
  chicken: [
    '오야코동', '간장치킨', '양념치킨', '후라이드', '깐풍기', '치킨너겟', '파닭',
    '반반치킨', '닭볶음탕', '닭갈비', '야키토리', '마늘치킨', '뿌링클', '허니콤보',
    '가라아게', '순살치킨', '닭강정', '매운치킨', '닭한마리', '삼계탕',
  ],
  beef: [
    '불고기', '갈비탕', '규동', '스테이크', '냉면', '육개장', '해장국', '양꼬치',
    '설렁탕', '갈비찜', '스키야키', '함박스테이크', '타코', '부리토',
  ],
  vegetarian: [
    // 돼지고기
    '삼겹살', '제육볶음', '돈카츠', '두루치기', '순대', '김치찌개', '쌈밥',
    '보쌈', '족발', '순대국밥', '감자탕', '돈가스', '꿔바로우', '카르보나라',
    '히레카츠', '마파두부', '오코노미야키', '반미', '분짜',
    // 소고기
    '규동', '불고기', '갈비탕', '육개장', '해장국', '설렁탕', '갈비찜',
    '스키야키', '함박스테이크', '타코', '부리토',
    // 닭고기
    '오야코동', '간장치킨', '양념치킨', '후라이드', '깐풍기', '치킨너겟', '파닭',
    '반반치킨', '닭볶음탕', '닭갈비', '야키토리', '마늘치킨', '뿌링클', '허니콤보',
    '가라아게', '순살치킨', '닭강정', '매운치킨', '닭한마리', '삼계탕',
    // 기타 육류
    '양꼬치',
  ],
  dairy: [
    '크림파스타', '리조또', '치즈떡볶이', '뇨끼', '뿌링클', '브런치', '카르보나라',
    '피자',       // 치즈
    '치즈버거',   // 치즈
  ],
  egg: [
    '오야코동', '텐동', '브런치', '타코야키', '오코노미야키', '카르보나라',
    '팟타이', '나시고렝',   // 계란 포함
  ],
  mushroom: ['나베'],
  gluten: [
    // 면류 (밀가루 면)
    '라멘', '우동', '소바', '짜장면', '짬뽕', '칼국수', '볶음우동', '쫄면', '라볶이',
    // 커틀렛·튀김옷류
    '돈카츠', '히레카츠', '돈가스', '가라아게', '튀김',
    // 치킨 전 종류 (튀김옷)
    '후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭',
    '마늘치킨', '뿌링클', '허니콤보', '순살치킨', '닭강정', '매운치킨', '치킨너겟',
    // 빵·반죽·파스타류
    '크림파스타', '알리오올리오', '뇨끼', '피자', '토마토파스타', '카르보나라', '봉골레',
    '함박스테이크', '버거', '치즈버거', '샌드위치', '랩', '핫도그', '타코', '부리토',
    // 만두·전류
    '만두', '딤섬', '타코야키', '오코노미야키',
    // 어묵류
    '어묵탕', '오뎅국물',
    // 동남아
    '반미',   // 바게트빵
  ],
  nuts: [],
}

// ─── 먹기 싫은 것 → 메뉴 필터 ─────────────────────────────────────────────────
const DONT_WANT_MENU_AVOID: Record<string, string[]> = {
  barbeque: ['삼겹살', '제육볶음', '갈비탕', '불고기', '돈카츠', '규동', '스테이크',
             '후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭', '오야코동',
             '닭볶음탕', '두루치기', '치킨너겟', '닭갈비', '야키토리', '보쌈', '족발',
             '양꼬치', '마늘치킨', '뿌링클', '허니콤보',
             '순살치킨', '닭강정', '매운치킨', '갈비찜', '닭한마리', '가라아게', '스키야키', '함박스테이크'],
}

// ─── 먹기 싫은 것 → 카테고리 제외 ────────────────────────────────────────────
const DISLIKE_TO_CATEGORY: Record<string, string[]> = {
  korean:   ['한식'],
  japanese: ['일식'],
  chinese:  ['중식'],
  western:  ['양식'],
  bunsik:   ['분식'],
  asian:    ['동남아'],
  barbeque: ['치킨'],
  fastfood: ['패스트푸드'],
}

// ─── 유틸: 무작위 샘플링 ──────────────────────────────────────────────────────
function shuffleAndPick<T>(arr: T[], n: number): T[] {
  const shuffled = arr.slice().sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

// excludeMenus: 재추천 시 이전에 보여준 메뉴를 전달받아 제외
function pickMenus(
  category: string,
  cantEat: string[],
  dontWant: string[] = [],
  excludeMenus: string[] = [],
): string[] {
  const all = CATEGORY_MENUS[category] ?? ['다양한 메뉴']
  const avoid = [
    ...cantEat.flatMap(r => RESTRICT_MENU_AVOID[r] ?? []),
    ...dontWant.flatMap(d => DONT_WANT_MENU_AVOID[d] ?? []),
  ]
  // 제약 조건 적용 후 이전에 보여준 메뉴 제외
  const filtered = all.filter(m => !avoid.some(a => m.includes(a)))
  const pool = filtered.length > 0 ? filtered : all
  const fresh = pool.filter(m => !excludeMenus.includes(m))
  // 새 메뉴가 5개 미만이면 기존 pool에서 보완
  const finalPool = fresh.length >= 5 ? fresh : pool
  return shuffleAndPick(finalPool, 3)
}

// ─── 메뉴별 카카오 키워드 검색 ────────────────────────────────────────────────
async function searchMenuRestaurants(
  key: string,
  query: string,
  coords?: { lat: number; lng: number },
): Promise<RestaurantItem[]> {
  try {
    let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`
    if (coords) {
      // 좌표가 있으면 반경 2km 내 거리순 정렬
      url += `&x=${coords.lng}&y=${coords.lat}&radius=2000&sort=distance`
    }
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
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
}

// ─── API Route ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { room_code, exclude_menus = [] } = await req.json()
  if (!room_code) return NextResponse.json({ error: '방 코드가 없습니다' }, { status: 400 })

  await supabase.from('rooms').update({ status: 'recommending' }).eq('code', room_code)

  try {
    const [{ data: roomData }, { data: participants, error: pErr }] = await Promise.all([
      supabase.from('rooms').select('location, lat, lng').eq('code', room_code).single(),
      supabase.from('participants').select('*').eq('room_code', room_code).eq('completed', true),
    ])

    if (pErr) throw pErr
    if (!participants?.length) {
      await supabase.from('rooms').update({ status: 'waiting' }).eq('code', room_code)
      return NextResponse.json({ error: '참여자가 없습니다' }, { status: 400 })
    }

    const locationText = roomData?.location ?? ''
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY

    // GPS 좌표 우선, 없으면 위치명을 카카오로 검색해 좌표 추출 (텍스트 입력 정확도 개선)
    let coords: { lat: number; lng: number } | null =
      (roomData?.lat && roomData?.lng)
        ? { lat: Number(roomData.lat), lng: Number(roomData.lng) }
        : null

    if (!coords && locationText && key) {
      try {
        const geoRes = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(locationText)}&size=1`,
          { headers: { Authorization: `KakaoAK ${key}` } }
        )
        const geoData = await geoRes.json()
        const place = geoData.documents?.[0]
        if (place?.x && place?.y) {
          coords = { lat: parseFloat(place.y), lng: parseFloat(place.x) }
        }
      } catch { /* 실패 시 텍스트 검색으로 폴백 */ }
    }

    const allCantEat = Array.from(new Set(participants.flatMap((p: { cant_eat?: string[] }) => p.cant_eat ?? [])))
    const allDontWant = Array.from(new Set(participants.flatMap((p: { dont_want?: string[] }) => p.dont_want ?? [])))

    // 카테고리별 메뉴 태스크 생성 (이전 메뉴 제외하여 새로운 조합 추천)
    type SearchTask = { category: string; menu: string }
    const tasks: SearchTask[] = []
    for (const category of Object.keys(CATEGORY_MENUS)) {
      const menus = pickMenus(category, allCantEat, allDontWant, exclude_menus)
      for (const menu of menus) {
        tasks.push({ category, menu })
      }
    }

    let isDummy = false
    let menuResults: RestaurantItem[][]

    if (key) {
      menuResults = await Promise.all(
        tasks.map(t => {
          // 좌표 있으면 메뉴명만 + 반경 거리순, 없으면 "장소명 메뉴명" 텍스트 검색
          const query = coords
            ? t.menu
            : (locationText ? `${locationText} ${t.menu}` : t.menu)
          return searchMenuRestaurants(key, query, coords ?? undefined)
        })
      )
    } else {
      isDummy = true
      menuResults = tasks.map(t => DUMMY_BY_CATEGORY[t.category] ?? [])
    }

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
