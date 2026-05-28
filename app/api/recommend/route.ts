import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Restaurant } from '@/types'
import { CANT_EAT_LABELS, DONT_WANT_LABELS, BUDGET_LABELS, SPICY_LABELS, MOOD_LABELS, CRAVING_LABELS } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ParticipantRow {
  name: string
  cant_eat: string[]
  dont_want: string[]
  budget: string
  spicy: string
  mood: string
  craving: string
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

// ─── 카테고리별 추천 메뉴 ────────────────────────────────────────────────────

const CATEGORY_MENUS: Record<string, string[]> = {
  한식:       ['된장찌개', '제육볶음', '비빔밥', '순두부찌개', '삼겹살', '갈비탕', '불고기'],
  일식:       ['라멘', '돈카츠', '우동', '규동', '오야코동', '스시', '나베'],
  중식:       ['짜장면', '짬뽕', '볶음밥', '탕수육', '마라탕', '깐풍기'],
  양식:       ['크림파스타', '피자', '스테이크', '리조또', '알리오올리오'],
  분식:       ['떡볶이', '순대', '튀김', '김밥', '라볶이', '치즈떡볶이'],
  치킨:       ['후라이드', '양념치킨', '간장치킨', '반반치킨'],
  패스트푸드: ['버거', '감자튀김', '치킨너겟', '콜라'],
}

// 못 먹는 재료 → 피해야 할 메뉴 키워드
const RESTRICT_MENU_AVOID: Record<string, string[]> = {
  pork:       ['삼겹살', '제육볶음', '순대', '돈카츠', '짜장면'],
  seafood:    ['짬뽕', '나베', '스시'],
  chicken:    ['오야코동', '간장치킨', '양념치킨', '후라이드', '깐풍기', '치킨너겟'],
  beef:       ['불고기', '갈비탕', '규동', '스테이크'],
  vegetarian: ['삼겹살', '제육볶음', '돈카츠', '규동', '불고기', '갈비탕', '순대', '후라이드', '양념치킨', '깐풍기'],
  dairy:      ['크림파스타', '리조또', '치즈떡볶이'],
  egg:        ['오야코동'],
}

function filterMenus(menus: string[], cantEat: string[]): string[] {
  const avoid = cantEat.flatMap(r => RESTRICT_MENU_AVOID[r] ?? [])
  return menus.filter(m => !avoid.some(a => m.includes(a)))
}

function pickMenus(category: string, cantEat: string[], count = 3): string[] {
  const all = CATEGORY_MENUS[category] ?? ['다양한 메뉴']
  const filtered = filterMenus(all, cantEat)
  return (filtered.length > 0 ? filtered : all).slice(0, count)
}

// ─── Kakao 식당 검색 ────────────────────────────────────────────────────────

interface KakaoDoc {
  place_name: string; address_name: string; category_name: string
  distance: string; phone: string; place_url: string; x: string; y: string
}

async function searchKakao(location: string, lat: number, lng: number): Promise<RawRestaurant[]> {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
  if (!key) return dummyRestaurants(location)

  try {
    const url = location
      ? `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(location + ' 맛집')}&size=15`
      : `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6&x=${lng}&y=${lat}&radius=1000&sort=distance&size=15`

    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!res.ok) return dummyRestaurants(location)
    const data = await res.json()
    if (!data.documents?.length) return dummyRestaurants(location)

    return (data.documents as KakaoDoc[]).map(d => ({
      name: d.place_name,
      address: d.address_name,
      category: d.category_name.split('>').pop()?.trim() ?? d.category_name,
      distance: d.distance || '500',
      phone: d.phone, url: d.place_url,
      lat: parseFloat(d.y), lng: parseFloat(d.x),
    }))
  } catch {
    return dummyRestaurants(location)
  }
}

function dummyRestaurants(location: string): RawRestaurant[] {
  const area = location || '서울'
  const base = { phone: '', url: '', lat: 37.5665, lng: 126.9780 }
  return [
    { name: '진이찬방',    address: `${area} 근처`, category: '한식',       distance: '150', ...base },
    { name: '스시히로',    address: `${area} 근처`, category: '일식',       distance: '220', ...base },
    { name: '홍콩반점',    address: `${area} 근처`, category: '중식',       distance: '310', ...base },
    { name: '파스타베네',  address: `${area} 근처`, category: '양식',       distance: '400', ...base },
    { name: '한촌설렁탕',  address: `${area} 근처`, category: '한식',       distance: '480', ...base },
    { name: '마루초밥',    address: `${area} 근처`, category: '일식',       distance: '540', ...base },
    { name: '엽기떡볶이',  address: `${area} 근처`, category: '분식',       distance: '600', ...base },
    { name: '굽네치킨',    address: `${area} 근처`, category: '치킨',       distance: '650', ...base },
    { name: '본죽&비빔밥', address: `${area} 근처`, category: '한식',       distance: '720', ...base },
    { name: '맥도날드',    address: `${area} 근처`, category: '패스트푸드', distance: '800', ...base },
  ]
}

// ─── 규칙 기반 추천 ──────────────────────────────────────────────────────────

const DISLIKE_TO_CATEGORY: Record<string, string[]> = {
  korean: ['한식'], chinese: ['중식'], japanese: ['일식'],
  western: ['양식'], bunsik: ['분식'], meat: ['치킨'], fastfood: ['패스트푸드'],
}

const QUICK_CATEGORIES = ['분식', '패스트푸드', '치킨']
const SPICY_HEAVY = ['분식', '중식']

function calcMatchCount(r: RawRestaurant, participants: ParticipantRow[]): number {
  return participants.filter(p => {
    const catDisliked = (p.dont_want ?? []).some(d => (DISLIKE_TO_CATEGORY[d] ?? []).includes(r.category))
    if (catDisliked) return false
    if (p.spicy === 'no' && SPICY_HEAVY.includes(r.category)) return false
    if (p.mood === 'quick' && !QUICK_CATEGORIES.includes(r.category)) return false
    return true
  }).length
}

function ruleBased(
  participants: ParticipantRow[],
  restaurants: RawRestaurant[],
  allCantEat: string[]
): { name: string; matchCount: number; reason: string; menus: string[] }[] {
  // 크레이빙(땡기는 것) 점수 보너스
  const cravingCounts: Record<string, number> = {}
  for (const p of participants) {
    if (p.craving) {
      const cats = DISLIKE_TO_CATEGORY[p.craving] ?? [p.craving]
      cats.forEach(c => { cravingCounts[c] = (cravingCounts[c] ?? 0) + 1 })
    }
  }

  const scored = restaurants.map(r => {
    const match = calcMatchCount(r, participants)
    const craving = cravingCounts[r.category] ?? 0
    return { r, score: match * 10 + craving * 3 - parseInt(r.distance) / 200 }
  })

  scored.sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const top5: typeof scored = []
  // 카테고리 다양성 우선
  for (const item of scored) {
    if (top5.length >= 5) break
    if (!seen.has(item.r.category)) { seen.add(item.r.category); top5.push(item) }
  }
  // 부족하면 나머지 채우기
  for (const item of scored) {
    if (top5.length >= 5) break
    if (!top5.includes(item)) top5.push(item)
  }

  return top5.map(({ r, score: _s }) => {
    const match = calcMatchCount(r, participants)
    const menus = pickMenus(r.category, allCantEat)
    let reason = '모두가 즐길 수 있는 선택이에요'
    if (match === participants.length) reason = `${participants.length}명 모두 조건에 맞아요 👍`
    else if (match > 0) reason = `${match}/${participants.length}명 조건 충족`
    return { name: r.name, matchCount: match, reason, menus }
  })
}

// ─── Claude 추천 ─────────────────────────────────────────────────────────────

function buildPrompt(participants: ParticipantRow[], restaurants: RawRestaurant[], location: string): string {
  const pSummary = participants.map(p => {
    const cant = p.cant_eat?.length ? p.cant_eat.map(id => CANT_EAT_LABELS[id] ?? id).join(', ') : '없음'
    const dont = p.dont_want?.length ? p.dont_want.map(id => DONT_WANT_LABELS[id] ?? id).join(', ') : '없음'
    const craving = p.craving ? CRAVING_LABELS[p.craving] ?? p.craving : '없음'
    return [
      `- ${p.name}:`,
      `  못 먹는 것=[${cant}]`,
      `  먹기 싫은 것=[${dont}]`,
      `  땡기는 것=[${craving}]`,
      `  매운 음식=[${SPICY_LABELS[p.spicy] ?? p.spicy}]`,
      `  식사 스타일=[${MOOD_LABELS[p.mood] ?? p.mood}]`,
      `  예산=[${BUDGET_LABELS[p.budget] ?? p.budget}]`,
    ].join('\n')
  }).join('\n\n')

  const rList = restaurants.map((r, i) =>
    `${i + 1}. ${r.name} (종류: ${r.category}, 거리: ${r.distance}m, 주소: ${r.address})`
  ).join('\n')

  return `당신은 그룹 식당 추천 전문가입니다.
약속 장소: ${location || '미정'}

## 참여자 ${participants.length}명
${pSummary}

## 근처 식당 목록
${rList}

## 작업
모든 참여자의 조건을 고려해 최적의 식당 5곳을 고르고, 각 식당에 맞는 추천 메뉴 3개도 제안해주세요.

반드시 아래 JSON만 출력하세요:
{
  "recommendations": [
    {"name": "식당이름(목록과 정확히 일치)", "matchCount": 숫자, "reason": "추천 이유 20자 이내", "menus": ["메뉴1", "메뉴2", "메뉴3"]},
    {"name": "...", "matchCount": 숫자, "reason": "...", "menus": ["...", "...", "..."]},
    {"name": "...", "matchCount": 숫자, "reason": "...", "menus": ["...", "...", "..."]},
    {"name": "...", "matchCount": 숫자, "reason": "...", "menus": ["...", "...", "..."]},
    {"name": "...", "matchCount": 숫자, "reason": "...", "menus": ["...", "...", "..."]}
  ]
}`
}

async function claudeRecommend(
  participants: ParticipantRow[],
  restaurants: RawRestaurant[],
  location: string
): Promise<{ name: string; matchCount: number; reason: string; menus: string[] }[]> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(participants, restaurants, location) }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonStr = text.includes('{') ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1) : text
  return JSON.parse(jsonStr).recommendations ?? []
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

    const location = roomData?.location ?? ''
    const rawRestaurants = await searchKakao(location, 37.5665, 126.9780)

    // 전체 제한 목록
    const allCantEat = [...new Set(participants.flatMap(p => p.cant_eat ?? []))]

    // Claude or 규칙 기반
    let recs: { name: string; matchCount: number; reason: string; menus: string[] }[] = []
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        recs = await claudeRecommend(participants, rawRestaurants, location)
      } catch {
        recs = ruleBased(participants, rawRestaurants, allCantEat)
      }
    } else {
      recs = ruleBased(participants, rawRestaurants, allCantEat)
    }

    const recommendations: Restaurant[] = recs.slice(0, 5).map(rec => {
      const raw = rawRestaurants.find(r => r.name === rec.name) ?? rawRestaurants[0]
      const menus = rec.menus?.length ? rec.menus : pickMenus(raw?.category ?? '한식', allCantEat)
      return {
        name: rec.name,
        distance: raw?.distance ?? '?',
        category: raw?.category ?? '음식점',
        matchCount: Math.min(rec.matchCount, participants.length),
        totalCount: participants.length,
        reason: rec.reason ?? '근처 맛집이에요',
        menus,
        address: raw?.address ?? '',
        phone: raw?.phone ?? '',
        url: raw?.url ?? '',
        lat: raw?.lat,
        lng: raw?.lng,
      }
    })

    // 5개 미만 채우기
    const usedNames = new Set(recommendations.map(r => r.name))
    for (const raw of rawRestaurants) {
      if (recommendations.length >= 5) break
      if (usedNames.has(raw.name)) continue
      recommendations.push({
        name: raw.name, distance: raw.distance, category: raw.category,
        matchCount: participants.length, totalCount: participants.length,
        reason: '근처 맛집이에요',
        menus: pickMenus(raw.category, allCantEat),
        address: raw.address, phone: raw.phone, url: raw.url,
        lat: raw.lat, lng: raw.lng,
      })
      usedNames.add(raw.name)
    }

    const { error: uErr } = await supabase
      .from('rooms').update({ recommendations, status: 'results' }).eq('code', room_code)
    if (uErr) throw uErr

    return NextResponse.json({ recommendations })
  } catch (e: unknown) {
    console.error('Recommend error:', e)
    await supabase.from('rooms').update({ status: 'waiting' }).eq('code', room_code)
    return NextResponse.json({ error: '추천에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
