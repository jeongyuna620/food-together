import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Restaurant } from '@/types'
import { CANT_EAT_LABELS, DONT_WANT_LABELS, BUDGET_LABELS } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── 타입 ────────────────────────────────────────────────────────────────────

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

// ─── Kakao 식당 검색 ────────────────────────────────────────────────────────

interface KakaoDoc {
  place_name: string
  address_name: string
  category_name: string
  distance: string
  phone: string
  place_url: string
  x: string
  y: string
}

async function searchKakao(lat: number, lng: number): Promise<RawRestaurant[]> {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
  if (!key) return dummyRestaurants(lat, lng)

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6&x=${lng}&y=${lat}&radius=1000&sort=distance&size=15`,
      { headers: { Authorization: `KakaoAK ${key}` } }
    )
    if (!res.ok) return dummyRestaurants(lat, lng)
    const data = await res.json()
    if (!data.documents?.length) return dummyRestaurants(lat, lng)

    return (data.documents as KakaoDoc[]).map(d => ({
      name: d.place_name,
      address: d.address_name,
      category: d.category_name.split('>').pop()?.trim() ?? d.category_name,
      distance: d.distance,
      phone: d.phone,
      url: d.place_url,
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
    }))
  } catch {
    return dummyRestaurants(lat, lng)
  }
}

function dummyRestaurants(lat: number, lng: number): RawRestaurant[] {
  return [
    { name: '진이찬방',    address: '서울시 강남구', category: '한식',       distance: '150', phone: '', url: '', lat: lat + 0.001, lng: lng + 0.001 },
    { name: '스시히로',    address: '서울시 강남구', category: '일식',       distance: '220', phone: '', url: '', lat: lat + 0.002, lng: lng + 0.002 },
    { name: '홍콩반점',    address: '서울시 강남구', category: '중식',       distance: '310', phone: '', url: '', lat: lat + 0.003, lng: lng + 0.003 },
    { name: '파스타베네',  address: '서울시 강남구', category: '양식',       distance: '400', phone: '', url: '', lat: lat + 0.004, lng: lng + 0.004 },
    { name: '한촌설렁탕',  address: '서울시 강남구', category: '한식',       distance: '480', phone: '', url: '', lat: lat + 0.005, lng: lng + 0.005 },
    { name: '마루초밥',    address: '서울시 강남구', category: '일식',       distance: '540', phone: '', url: '', lat: lat + 0.006, lng: lng + 0.006 },
    { name: '엽기떡볶이',  address: '서울시 강남구', category: '분식',       distance: '600', phone: '', url: '', lat: lat + 0.007, lng: lng + 0.007 },
    { name: '굽네치킨',    address: '서울시 강남구', category: '치킨',       distance: '650', phone: '', url: '', lat: lat + 0.008, lng: lng + 0.008 },
    { name: '본죽&비빔밥', address: '서울시 강남구', category: '한식',       distance: '720', phone: '', url: '', lat: lat + 0.009, lng: lng + 0.009 },
    { name: '맥도날드',    address: '서울시 강남구', category: '패스트푸드', distance: '800', phone: '', url: '', lat: lat + 0.010, lng: lng + 0.010 },
  ]
}

// ─── 규칙 기반 추천 (API 키 없을 때) ─────────────────────────────────────────

const DISLIKE_TO_CATEGORY: Record<string, string[]> = {
  korean:   ['한식'],
  chinese:  ['중식'],
  japanese: ['일식'],
  western:  ['양식'],
  bunsik:   ['분식'],
  meat:     ['치킨'],
  soup:     [],
}

// 재료 제한별 피해야 할 카테고리
const RESTRICTION_AVOID: Record<string, string[]> = {
  pork:       ['분식'],           // 순대 등
  seafood:    [],                  // 대부분 선택 가능
  chicken:    ['치킨'],
  beef:       [],
  vegetarian: ['치킨', '패스트푸드'],
  dairy:      [],
  gluten:     [],
}

const REASON_MAP: Record<string, string> = {
  한식:       '모두가 편하게 먹을 수 있는 선택이에요',
  일식:       '다양한 입맛에 맞는 메뉴가 많아요',
  중식:       '가성비 좋고 푸짐하게 즐길 수 있어요',
  양식:       '분위기 있게 즐길 수 있는 선택이에요',
  분식:       '가볍고 빠르게 먹을 수 있어요',
  치킨:       '다 같이 즐기기 좋은 선택이에요',
  패스트푸드: '빠르고 간편하게 먹을 수 있어요',
}

function calcMatchCount(restaurant: RawRestaurant, participants: ParticipantRow[]): number {
  return participants.filter(p => {
    const catDisliked = (p.dont_want ?? []).some(d =>
      (DISLIKE_TO_CATEGORY[d] ?? []).includes(restaurant.category)
    )
    if (catDisliked) return false

    const restrictionBlocked = (p.cant_eat ?? []).some(r =>
      (RESTRICTION_AVOID[r] ?? []).includes(restaurant.category)
    )
    return !restrictionBlocked
  }).length
}

function ruleBased(participants: ParticipantRow[], restaurants: RawRestaurant[]): { name: string; matchCount: number; reason: string }[] {
  const scored = restaurants.map(r => ({
    r,
    score: calcMatchCount(r, participants),
  }))

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return parseInt(a.r.distance) - parseInt(b.r.distance)
  })

  const seen = new Set<string>()
  const top3: typeof scored = []
  for (const item of scored) {
    if (top3.length >= 3) break
    if (seen.has(item.r.category)) continue
    seen.add(item.r.category)
    top3.push(item)
  }

  // 카테고리 다양성 확보 후 부족하면 그냥 채우기
  for (const item of scored) {
    if (top3.length >= 3) break
    if (top3.includes(item)) continue
    top3.push(item)
  }

  return top3.map(({ r, score }) => ({
    name: r.name,
    matchCount: score,
    reason: REASON_MAP[r.category] ?? '근처 맛집이에요',
  }))
}

// ─── Claude 추천 (API 키 있을 때) ────────────────────────────────────────────

function buildPrompt(participants: ParticipantRow[], restaurants: RawRestaurant[]): string {
  const pSummary = participants.map(p => {
    const cant = p.cant_eat?.length ? p.cant_eat.map(id => CANT_EAT_LABELS[id] ?? id).join(', ') : '없음'
    const dont = p.dont_want?.length ? p.dont_want.map(id => DONT_WANT_LABELS[id] ?? id).join(', ') : '없음'
    const budget = BUDGET_LABELS[p.budget] ?? p.budget ?? '무관'
    return `- ${p.name}: 못 먹는 것=[${cant}] / 먹기 싫은 것=[${dont}] / 예산=${budget}`
  }).join('\n')

  const rList = restaurants.map((r, i) =>
    `${i + 1}. ${r.name} (종류: ${r.category}, 거리: ${r.distance}m, 주소: ${r.address})`
  ).join('\n')

  return `당신은 그룹 식당 추천 전문가입니다.

## 참여자 ${participants.length}명
${pSummary}

## 근처 식당 목록
${rList}

## 작업
모든 참여자의 제약을 최대한 만족하는 식당 3곳을 골라주세요.

반드시 아래 JSON만 출력하세요:
{
  "recommendations": [
    {"name": "식당이름(목록과 정확히 일치)", "matchCount": 숫자, "reason": "추천 이유 20자 이내"},
    {"name": "...", "matchCount": 숫자, "reason": "..."},
    {"name": "...", "matchCount": 숫자, "reason": "..."}
  ]
}`
}

async function claudeRecommend(
  participants: ParticipantRow[],
  restaurants: RawRestaurant[]
): Promise<{ name: string; matchCount: number; reason: string }[]> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(participants, restaurants) }],
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
    const { data: participants, error: pErr } = await supabase
      .from('participants')
      .select('*')
      .eq('room_code', room_code)
      .eq('completed', true)

    if (pErr) throw pErr
    if (!participants?.length) {
      await supabase.from('rooms').update({ status: 'waiting' }).eq('code', room_code)
      return NextResponse.json({ error: '참여자가 없습니다' }, { status: 400 })
    }

    const withLoc = participants.filter(p => p.lat && p.lng)
    const lat = withLoc.length > 0 ? withLoc.reduce((s, p) => s + p.lat, 0) / withLoc.length : 37.5665
    const lng = withLoc.length > 0 ? withLoc.reduce((s, p) => s + p.lng, 0) / withLoc.length : 126.9780

    const rawRestaurants = await searchKakao(lat, lng)

    // Claude API 키 있으면 AI 추천, 없으면 규칙 기반으로 자동 전환
    let recs: { name: string; matchCount: number; reason: string }[] = []
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        recs = await claudeRecommend(participants, rawRestaurants)
      } catch {
        recs = ruleBased(participants, rawRestaurants)
      }
    } else {
      recs = ruleBased(participants, rawRestaurants)
    }

    const recommendations: Restaurant[] = recs.slice(0, 3).map(rec => {
      const raw = rawRestaurants.find(r => r.name === rec.name) ?? rawRestaurants[0]
      return {
        name: rec.name,
        distance: raw?.distance ?? '?',
        category: raw?.category ?? '음식점',
        matchCount: Math.min(rec.matchCount, participants.length),
        totalCount: participants.length,
        reason: rec.reason ?? '근처 맛집이에요',
        address: raw?.address ?? '',
        phone: raw?.phone ?? '',
        url: raw?.url ?? '',
        lat: raw?.lat,
        lng: raw?.lng,
      }
    })

    // 3개 미만이면 채우기
    const usedNames = new Set(recommendations.map(r => r.name))
    for (const raw of rawRestaurants) {
      if (recommendations.length >= 3) break
      if (usedNames.has(raw.name)) continue
      recommendations.push({
        name: raw.name, distance: raw.distance, category: raw.category,
        matchCount: participants.length, totalCount: participants.length,
        reason: REASON_MAP[raw.category] ?? '근처 맛집이에요',
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
