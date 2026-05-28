import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { Restaurant } from '@/types'
import { CANT_EAT_LABELS, DONT_WANT_LABELS, BUDGET_LABELS } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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
    { name: '진이찬방',      address: '서울시 강남구',  category: '한식',     distance: '150',  phone: '', url: '', lat: lat + 0.001, lng: lng + 0.001 },
    { name: '스시히로',      address: '서울시 강남구',  category: '일식',     distance: '220',  phone: '', url: '', lat: lat + 0.002, lng: lng + 0.002 },
    { name: '홍콩반점',      address: '서울시 강남구',  category: '중식',     distance: '310',  phone: '', url: '', lat: lat + 0.003, lng: lng + 0.003 },
    { name: '파스타베네',    address: '서울시 강남구',  category: '양식',     distance: '400',  phone: '', url: '', lat: lat + 0.004, lng: lng + 0.004 },
    { name: '한촌설렁탕',    address: '서울시 강남구',  category: '한식',     distance: '480',  phone: '', url: '', lat: lat + 0.005, lng: lng + 0.005 },
    { name: '마루초밥',      address: '서울시 강남구',  category: '일식',     distance: '540',  phone: '', url: '', lat: lat + 0.006, lng: lng + 0.006 },
    { name: '엽기떡볶이',    address: '서울시 강남구',  category: '분식',     distance: '600',  phone: '', url: '', lat: lat + 0.007, lng: lng + 0.007 },
    { name: '굽네치킨',      address: '서울시 강남구',  category: '치킨',     distance: '650',  phone: '', url: '', lat: lat + 0.008, lng: lng + 0.008 },
    { name: '본죽&비빔밥',   address: '서울시 강남구',  category: '한식',     distance: '720',  phone: '', url: '', lat: lat + 0.009, lng: lng + 0.009 },
    { name: '맥도날드',      address: '서울시 강남구',  category: '패스트푸드', distance: '800', phone: '', url: '', lat: lat + 0.010, lng: lng + 0.010 },
  ]
}

// ─── Claude 프롬프트 ────────────────────────────────────────────────────────

interface ParticipantRow {
  name: string
  cant_eat: string[]
  dont_want: string[]
  budget: string
}

function buildPrompt(participants: ParticipantRow[], restaurants: RawRestaurant[]): string {
  const pSummary = participants.map(p => {
    const cant = p.cant_eat?.length
      ? p.cant_eat.map(id => CANT_EAT_LABELS[id] ?? id).join(', ')
      : '없음'
    const dont = p.dont_want?.length
      ? p.dont_want.map(id => DONT_WANT_LABELS[id] ?? id).join(', ')
      : '없음'
    const budget = BUDGET_LABELS[p.budget] ?? p.budget ?? '무관'
    return `- ${p.name}: 못 먹는 것=[${cant}] / 먹기 싫은 것=[${dont}] / 예산=${budget}`
  }).join('\n')

  const rList = restaurants.map((r, i) =>
    `${i + 1}. ${r.name} (종류: ${r.category}, 거리: ${r.distance}m, 주소: ${r.address})`
  ).join('\n')

  return `당신은 그룹 식당 추천 전문가입니다.

## 참여자 ${participants.length}명
${pSummary}

## 예산 기준
- "1만원 이하" = 저렴한 한식, 분식류
- "1~2만원" = 일반 음식점
- "2만원 이상" = 고급 음식점

## 근처 식당 목록
${rList}

## 작업
위 식당 중에서 모든 참여자의 제약(못 먹는 것, 먹기 싫은 것, 예산)을 최대한 만족하는 식당 3곳을 골라주세요.
각 식당에 대해 조건을 충족하는 참여자 수와 한 줄 추천 이유(20자 이내)를 포함해주세요.

반드시 아래 JSON 형식만 출력하세요 (다른 텍스트 없음):
{
  "recommendations": [
    {"name": "식당이름(목록과 정확히 일치)", "matchCount": 숫자, "reason": "추천 이유"},
    {"name": "...", "matchCount": 숫자, "reason": "..."},
    {"name": "...", "matchCount": 숫자, "reason": "..."}
  ]
}`
}

// ─── API Route ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { room_code } = await req.json()
  if (!room_code) return NextResponse.json({ error: '방 코드가 없습니다' }, { status: 400 })

  // 상태를 'recommending'으로 먼저 업데이트
  await supabase.from('rooms').update({ status: 'recommending' }).eq('code', room_code)

  try {
    // 완료된 참여자 조회
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

    // 평균 위치 계산
    const withLoc = participants.filter(p => p.lat && p.lng)
    const lat = withLoc.length > 0
      ? withLoc.reduce((s, p) => s + p.lat, 0) / withLoc.length
      : 37.5665
    const lng = withLoc.length > 0
      ? withLoc.reduce((s, p) => s + p.lng, 0) / withLoc.length
      : 126.9780

    // 카카오 식당 검색
    const rawRestaurants = await searchKakao(lat, lng)

    // Claude 추천 요청
    const prompt = buildPrompt(participants, rawRestaurants)
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''

    let claudeRecs: { name: string; matchCount: number; reason: string }[] = []
    try {
      const jsonStr = text.includes('{') ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1) : text
      claudeRecs = JSON.parse(jsonStr).recommendations ?? []
    } catch {
      claudeRecs = []
    }

    // 추천 결과 병합
    const recommendations: Restaurant[] = claudeRecs.slice(0, 3).map(rec => {
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

    // Claude가 3개 미만 반환 시 나머지 채우기
    const usedNames = new Set(recommendations.map(r => r.name))
    for (const raw of rawRestaurants) {
      if (recommendations.length >= 3) break
      if (usedNames.has(raw.name)) continue
      recommendations.push({
        name: raw.name, distance: raw.distance, category: raw.category,
        matchCount: participants.length, totalCount: participants.length,
        reason: '근처에 있는 맛집이에요',
        address: raw.address, phone: raw.phone, url: raw.url,
        lat: raw.lat, lng: raw.lng,
      })
      usedNames.add(raw.name)
    }

    // 결과 저장 및 상태를 'results'로 변경
    const { error: uErr } = await supabase
      .from('rooms')
      .update({ recommendations, status: 'results' })
      .eq('code', room_code)

    if (uErr) throw uErr

    return NextResponse.json({ recommendations })
  } catch (e: unknown) {
    console.error('Recommend error:', e)
    await supabase.from('rooms').update({ status: 'waiting' }).eq('code', room_code)
    return NextResponse.json({ error: '추천에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
