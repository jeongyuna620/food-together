'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDistance } from '@/lib/utils'
import type { CategoryRecommendation, MenuRecommendation, RestaurantItem, Vote } from '@/types'

declare global { interface Window { kakao: any } }

// ─── 클라이언트측 카테고리 정규화 (JS SDK 폴백용) ─────────────────────────────
const ALLOWED_CATEGORIES = new Set(['한식', '중식', '일식', '양식', '분식', '치킨', '패스트푸드'])

function normalizeCategory(raw: string): string {
  if (/중국|중식/.test(raw)) return '중식'
  if (/일식|일본|초밥|라멘|우동|돈카츠|사시미/.test(raw)) return '일식'
  if (/양식|이탈리안|패밀리레스토랑|피자|파스타|스테이크/.test(raw)) return '양식'
  if (/분식|떡볶이/.test(raw)) return '분식'
  if (/치킨/.test(raw)) return '치킨'
  if (/패스트푸드|햄버거/.test(raw)) return '패스트푸드'
  if (/요리주점|이자카야|호프|선술집|포장마차/.test(raw)) return '요리주점'
  if (/한식|한정식|국밥|해장국|삼겹살|갈비|설렁탕|백반|구이전문|찌개|냉면/.test(raw)) return '한식'
  return '기타'
}

const CATEGORY_MENUS: Record<string, string[]> = {
  한식: ['된장찌개', '제육볶음', '비빔밥', '순두부찌개', '삼겹살', '갈비탕', '불고기', '칼국수',
        '김치찌개', '닭갈비', '쌈밥', '냉면', '육개장', '해장국'],
  일식: ['라멘', '돈카츠', '우동', '규동', '오야코동', '스시', '나베', '소바',
        '야키토리', '텐동', '히레카츠', '새우튀김덮밥'],
  중식: ['짜장면', '짬뽕', '볶음밥', '탕수육', '마라탕', '깐풍기', '딤섬', '마라샹궈', '양꼬치', '훠궈'],
  양식: ['크림파스타', '피자', '스테이크', '리조또', '알리오올리오', '뇨끼', '토마토파스타', '샐러드', '브런치'],
  분식: ['떡볶이', '순대', '튀김', '김밥', '라볶이', '치즈떡볶이', '쫄면', '핫도그', '어묵탕', '만두'],
  치킨: ['후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭', '마늘치킨', '뿌링클', '허니콤보'],
  패스트푸드: ['버거', '감자튀김', '치킨너겟', '치즈버거', '샌드위치', '랩'],
}
const RESTRICT_AVOID: Record<string, string[]> = {
  pork:       ['삼겹살', '제육볶음', '순대', '돈카츠', '두루치기'],
  seafood:    ['짬뽕', '나베', '스시', '소바', '해물파전'],
  chicken:    ['오야코동', '간장치킨', '양념치킨', '후라이드', '깐풍기', '치킨너겟', '파닭', '반반치킨', '닭볶음탕'],
  beef:       ['불고기', '갈비탕', '규동', '스테이크'],
  vegetarian: ['삼겹살', '제육볶음', '돈카츠', '규동', '불고기', '갈비탕', '순대', '후라이드', '양념치킨',
               '깐풍기', '닭볶음탕', '두루치기', '오야코동', '치킨너겟', '간장치킨', '반반치킨', '파닭'],
  dairy:      ['크림파스타', '리조또', '치즈떡볶이', '뇨끼'],
  egg:        ['오야코동'], mushroom: ['나베'],
  gluten:     ['라멘', '우동', '소바', '짜장면', '짬뽕', '칼국수', '돈카츠', '크림파스타', '알리오올리오', '뇨끼', '피자'],
  nuts:       [],
}
const DONT_WANT_AVOID: Record<string, string[]> = {
  barbeque: ['삼겹살', '제육볶음', '갈비탕', '불고기', '돈카츠', '규동', '스테이크',
             '후라이드', '양념치킨', '간장치킨', '반반치킨', '파닭', '오야코동',
             '닭볶음탕', '두루치기', '치킨너겟', '닭갈비', '야키토리', '보쌈', '족발',
             '양꼬치', '마늘치킨', '뿌링클', '허니콤보'],
  soup:     ['된장찌개', '순두부찌개', '갈비탕', '칼국수', '라멘', '우동', '짬뽕', '나베',
             '김치찌개', '육개장', '해장국', '훠궈'],
}
const DISLIKE_MAP: Record<string, string[]> = {
  korean:   ['한식'],
  japanese: ['일식'],
  chinese:  ['중식'],
  western:  ['양식'],
  bunsik:   ['분식'],
  barbeque: ['치킨'],
  fastfood: ['패스트푸드'],
}

function pickMenus(cat: string, cantEat: string[], dontWant: string[] = []): string[] {
  const all = CATEGORY_MENUS[cat] ?? ['다양한 메뉴']
  const avoid = [
    ...cantEat.flatMap(r => RESTRICT_AVOID[r] ?? []),
    ...dontWant.flatMap(d => DONT_WANT_AVOID[d] ?? []),
  ]
  const filtered = all.filter(m => !avoid.some(a => m.includes(a)))
  return filtered.length > 0 ? filtered : all
}

interface PlaceRow { name: string; address: string; category: string; distance: string; phone: string; url: string; lat: number; lng: number }
interface ParticipantRow { cant_eat: string[]; dont_want: string[] }

// JS SDK 폴백용: 카테고리 내 식당을 각 메뉴에 동일하게 배정
function buildGroups(places: PlaceRow[], participants: ParticipantRow[]): CategoryRecommendation[] {
  const byCat: Record<string, PlaceRow[]> = {}
  for (const p of places) {
    const c = p.category || '기타'
    if (!ALLOWED_CATEGORIES.has(c)) continue
    ;(byCat[c] = byCat[c] ?? []).push(p)
  }
  const allCantEat = Array.from(new Set(participants.flatMap(p => p.cant_eat ?? [])))
  const allDontWant = Array.from(new Set(participants.flatMap(p => p.dont_want ?? [])))
  const result: CategoryRecommendation[] = Object.entries(byCat).map(([category, rests]) => {
    const menuNames = pickMenus(category, allCantEat, allDontWant)
    const sortedRests: RestaurantItem[] = [...rests]
      .sort((a, b) => (parseInt(a.distance) || 0) - (parseInt(b.distance) || 0))
      .map(r => ({ name: r.name, address: r.address, distance: r.distance, phone: r.phone, url: r.url, lat: r.lat, lng: r.lng }))
    const menus: MenuRecommendation[] = menuNames.map(menuName => ({ name: menuName, restaurants: sortedRests }))
    return {
      category,
      menus,
      matchCount: participants.filter(p => !(p.dont_want ?? []).some(d => (DISLIKE_MAP[d] ?? []).includes(category))).length,
      totalCount: participants.length,
    }
  })
  result.sort((a, b) =>
    b.matchCount !== a.matchCount ? b.matchCount - a.matchCount :
    b.menus.flatMap(m => m.restaurants).length - a.menus.flatMap(m => m.restaurants).length
  )
  return result
}

// 구형 데이터(menus: string[]) → 신형(menus: MenuRecommendation[]) 변환
function migrateOldFormat(cats: CategoryRecommendation[]): CategoryRecommendation[] {
  return cats.map(g => {
    if (g.menus.length === 0 || typeof (g.menus[0] as any) !== 'string') return g
    const oldData = g as any
    const categoryRestaurants: RestaurantItem[] = oldData.restaurants ?? []
    return {
      ...g,
      menus: (g.menus as any as string[]).map(name => ({
        name,
        restaurants: categoryRestaurants,
      })),
    }
  })
}

function loadKakaoMaps(appKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.services) { resolve(); return }
    const s = document.createElement('script')
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`
    s.onload = () => window.kakao.maps.load(resolve)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function kakaoJsSearch(location: string): Promise<PlaceRow[]> {
  return new Promise(resolve => {
    const ps = new window.kakao.maps.services.Places()
    const all: any[] = []
    let done = 0
    for (let page = 1; page <= 3; page++) {
      ps.keywordSearch(`${location} 음식점`, (data: any[], status: string) => {
        if (status === 'OK') all.push(...data)
        if (++done === 3) {
          const seen = new Set<string>()
          resolve(all
            .filter(r => { if (seen.has(r.place_name)) return false; seen.add(r.place_name); return true })
            .map(r => ({
              name: r.place_name, address: r.address_name,
              category: normalizeCategory(r.category_name),
              distance: r.distance || '', phone: r.phone || '',
              url: r.place_url || '', lat: parseFloat(r.y), lng: parseFloat(r.x),
            })))
        }
      }, { page, size: 15 })
    }
  })
}

export default function ResultsPage() {
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [groups, setGroups] = useState<CategoryRecommendation[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [myName, setMyName] = useState('')
  const [myVotes, setMyVotes] = useState<Record<string, 'ok' | 'no'>>({})
  const [selectedMenu, setSelectedMenu] = useState<{ category: string; menu: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [reRecommending, setReRecommending] = useState(false)

  useEffect(() => {
    const name = localStorage.getItem('participantName') ?? ''
    const isHost = localStorage.getItem('isHost') === 'true'
    setMyName(name)

    const load = async () => {
      const [{ data: roomData }, { data: voteData }, { data: partData }] = await Promise.all([
        supabase.from('rooms').select('recommendations, location').eq('code', code).single(),
        supabase.from('votes').select('*').eq('room_code', code),
        supabase.from('participants').select('cant_eat, dont_want').eq('room_code', code).eq('completed', true),
      ])

      if (roomData?.recommendations) {
        const raw = roomData.recommendations as CategoryRecommendation[]
        // 구형 데이터 포맷 자동 변환 (menus: string[] → MenuRecommendation[])
        const cats = migrateOldFormat(raw)
        setGroups(cats)

        // 더미 데이터 감지: 모든 식당에 URL이 없으면 JS SDK로 재검색 (방장만)
        const isDummy = cats.every(g => g.menus.every(m => m.restaurants.every(r => !r.url)))
        const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
        if (isDummy && isHost && jsKey && roomData.location) {
          setSearching(true)
          try {
            await loadKakaoMaps(jsKey)
            const places = await kakaoJsSearch(roomData.location)
            if (places.length > 0) {
              const recs = buildGroups(places, partData ?? [])
              await supabase.from('rooms').update({ recommendations: recs }).eq('code', code)
              setGroups(recs)
            }
          } catch (e) { console.error('JS SDK search failed', e) }
          setSearching(false)
        }
      }

      if (voteData) {
        setVotes(voteData as Vote[])
        const mv: Record<string, 'ok' | 'no'> = {}
        ;(voteData as Vote[]).filter(v => v.participant_name === name).forEach(v => { mv[v.restaurant_name] = v.vote })
        setMyVotes(mv)
      }
      setLoading(false)
    }
    load()

    const ch = supabase
      .channel(`results-${code}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `room_code=eq.${code}` },
        p => setVotes(prev => [...prev, p.new as Vote]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'votes', filter: `room_code=eq.${code}` },
        p => setVotes(prev => prev.map(v => v.id === (p.new as Vote).id ? p.new as Vote : v)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        p => {
          if (p.new.recommendations) {
            const cats = migrateOldFormat(p.new.recommendations as CategoryRecommendation[])
            setGroups(cats)
            setSelectedMenu(null)
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [code])

  const okCount = (name: string) => votes.filter(v => v.restaurant_name === name && v.vote === 'ok').length
  const noCount = (name: string) => votes.filter(v => v.restaurant_name === name && v.vote === 'no').length

  // 투표 집계를 위해 전체 유니크 식당 수집
  const allRestaurantsMap = new Map<string, RestaurantItem>()
  groups.forEach(g => g.menus.forEach(m => m.restaurants.forEach(r => {
    if (!allRestaurantsMap.has(r.name)) allRestaurantsMap.set(r.name, r)
  })))
  const allRestaurants = Array.from(allRestaurantsMap.values())

  const winnerEntry = allRestaurants.length > 0
    ? allRestaurants.reduce<{ r: RestaurantItem; ok: number } | null>((best, r) => {
        const ok = okCount(r.name); return ok > 0 && (!best || ok > best.ok) ? { r, ok } : best
      }, null)
    : null
  const winnerGroup = winnerEntry
    ? groups.find(g => g.menus.some(m => m.restaurants.some(r => r.name === winnerEntry.r.name)))
    : null

  const handleMenuClick = (category: string, menu: string) => {
    setSelectedMenu(prev =>
      prev?.category === category && prev?.menu === menu ? null : { category, menu }
    )
  }

  const handleVote = async (restaurantName: string, vote: 'ok' | 'no') => {
    if (!myName) return
    setMyVotes(prev => ({ ...prev, [restaurantName]: vote }))
    const existing = votes.find(v => v.participant_name === myName && v.restaurant_name === restaurantName)
    if (existing) {
      await supabase.from('votes').update({ vote }).eq('id', existing.id)
    } else {
      await supabase.from('votes').insert({ room_code: code, participant_name: myName, restaurant_name: restaurantName, vote })
    }
  }

  const handleReRecommend = async () => {
    setReRecommending(true)
    setSelectedMenu(null)
    // 현재 화면에 보이는 메뉴를 전달 → 서버에서 해당 메뉴를 제외하고 새 조합 선택
    const shownMenus = groups.flatMap(g => g.menus.map(m => m.name))
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: code, exclude_menus: shownMenus }),
      })
      const data = await res.json()
      if (data.recommendations) {
        setGroups(migrateOldFormat(data.recommendations))
      }
    } catch (e) { console.error(e) }
    setReRecommending(false)
  }

  const kakaoPlaceLink = (r: RestaurantItem) => r.url || `https://map.kakao.com/?q=${encodeURIComponent(r.name)}`
  const kakaoNavLink = (r: RestaurantItem) =>
    r.lat && r.lng ? `https://map.kakao.com/link/to/${encodeURIComponent(r.name)},${r.lat},${r.lng}` : `https://map.kakao.com/?q=${encodeURIComponent(r.name)}`

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-5xl mb-3 animate-bounce">🍽️</div>
        <p className="text-gray-500 animate-pulse">결과 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-violet-600 text-white py-5 px-4 text-center">
        <p className="text-2xl mb-1">🎉</p>
        <h1 className="text-xl font-black">추천 결과</h1>
        <p className="text-violet-200 text-sm mt-1">메뉴를 눌러 식당을 확인하세요</p>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-3">
        {/* JS SDK 검색 중 배너 */}
        {searching && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-center">
            <p className="text-violet-700 text-sm font-semibold animate-pulse">📍 주변 식당 실시간 검색 중...</p>
          </div>
        )}

        {/* 더미 데이터 경고 */}
        {!searching && groups.length > 0 && groups.every(g => g.menus.every(m => m.restaurants.every(r => !r.url))) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <p className="text-yellow-800 text-sm font-semibold mb-1">⚠️ 샘플 데이터가 표시되고 있어요</p>
            <p className="text-yellow-700 text-xs">
              Vercel 환경변수에 <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_KAKAO_JS_KEY</code>를 추가하면 실제 주변 식당이 표시돼요.
            </p>
          </div>
        )}

        {/* 현재 1위 배너 */}
        {winnerEntry && winnerGroup && (
          <div className="bg-gradient-to-r from-yellow-400 to-amber-400 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">👑</span>
              <span className="font-bold text-sm">현재 1위</span>
            </div>
            <p className="text-xl font-black mb-0.5">{winnerEntry.r.name}</p>
            <p className="text-yellow-100 text-sm mb-3">OK {winnerEntry.ok}표 · {winnerGroup.category}</p>
            <a href={kakaoNavLink(winnerEntry.r)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-white text-amber-600 font-bold px-4 py-2 rounded-xl text-sm shadow-sm">
              🗺️ 카카오맵 길찾기
            </a>
          </div>
        )}

        {/* 카테고리 카드 — 전체 표시 (matchCount 높은 순 정렬) */}
        {groups.map(group => {
          const isFullMatch = group.matchCount === group.totalCount
          const isBlocked = group.matchCount === 0   // 모두 싫다고 한 카테고리
          const isOpen = !isBlocked && selectedMenu?.category === group.category
          const selectedMenuData = isOpen
            ? group.menus.find(m => m.name === selectedMenu?.menu) ?? null
            : null
          const restaurants = selectedMenuData?.restaurants ?? []

          return (
            <div key={group.category} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 카테고리 헤더 */}
              <div className={`px-4 pt-4 ${isBlocked ? 'pb-4' : 'pb-3'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className={`font-bold text-base ${isBlocked ? 'text-gray-400' : ''}`}>{group.category}</h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isFullMatch ? 'bg-green-100 text-green-700' :
                    isBlocked   ? 'bg-red-100 text-red-400'    : 'bg-violet-100 text-violet-700'
                  }`}>
                    {isFullMatch ? '✓ 모두 가능' : isBlocked ? '❌ 전원 제외' : `${group.matchCount}/${group.totalCount}명 가능`}
                  </span>
                  {!isBlocked && (
                    <span className="ml-auto text-gray-400 text-xs">
                      {isOpen ? `${restaurants.length}곳` : `${group.menus.length}개 메뉴`}
                    </span>
                  )}
                </div>

                {/* 불가 카테고리는 메뉴 없이 안내 문구만 */}
                {isBlocked ? (
                  <p className="text-xs text-gray-400">모든 참여자가 제외한 카테고리예요</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-2">먹고 싶은 메뉴를 선택하세요</p>
                    <div className="flex flex-wrap gap-2">
                      {group.menus.map(menu => {
                        const active = selectedMenu?.category === group.category && selectedMenu?.menu === menu.name
                        return (
                          <button
                            key={menu.name}
                            onClick={() => handleMenuClick(group.category, menu.name)}
                            className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all active:scale-95 ${
                              active
                                ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
                                : 'border-violet-200 bg-violet-50 text-violet-600'
                            }`}
                          >
                            {active ? '✓ ' : ''}{menu.name}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 식당 목록 — 선택된 메뉴의 식당 표시 */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                    <span className="font-semibold text-violet-600">{selectedMenu?.menu}</span> 파는 식당 {restaurants.length}곳
                  </p>
                  {restaurants.length === 0 ? (
                    <p className="px-4 py-4 text-center text-gray-400 text-sm">근처에 식당 정보가 없어요</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {restaurants.map(r => {
                        const ok = okCount(r.name); const no = noCount(r.name); const myVote = myVotes[r.name]
                        return (
                          <div key={r.name} className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm leading-snug">{r.name}</p>
                                {r.address && <p className="text-gray-400 text-xs mt-0.5 truncate">{r.address}</p>}
                                {r.distance && <p className="text-gray-400 text-xs">{formatDistance(r.distance)}</p>}
                              </div>
                              <a href={kakaoPlaceLink(r)} target="_blank" rel="noopener noreferrer"
                                className="flex-shrink-0 text-xs text-blue-500 font-medium underline mt-0.5">지도</a>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleVote(r.name, 'ok')}
                                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${myVote === 'ok' ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>
                                👍 OK{ok > 0 ? ` (${ok})` : ''}
                              </button>
                              <button onClick={() => handleVote(r.name, 'no')}
                                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${myVote === 'no' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>
                                👎 NO{no > 0 ? ` (${no})` : ''}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {groups.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">😅</p>
            <p>추천 결과가 없어요</p>
          </div>
        )}

        {/* 재추천 버튼 */}
        {groups.length > 0 && (
          <div className="pt-2 pb-4 text-center">
            <button
              onClick={handleReRecommend}
              disabled={reRecommending}
              className="w-full bg-white border-2 border-violet-200 text-violet-600 font-bold py-4 rounded-2xl shadow-sm active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              {reRecommending ? '🔄 새 조합 찾는 중...' : '🔀 다른 조합 추천받기'}
            </button>
            <p className="text-xs text-gray-400 mt-2">누르면 모든 참여자에게 새 추천이 적용돼요</p>
          </div>
        )}
      </div>
    </div>
  )
}
