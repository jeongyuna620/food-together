'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDistance } from '@/lib/utils'
import type { CategoryRecommendation, RestaurantItem, Vote } from '@/types'

export default function ResultsPage() {
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [groups, setGroups] = useState<CategoryRecommendation[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [myName, setMyName] = useState('')
  const [myVotes, setMyVotes] = useState<Record<string, 'ok' | 'no'>>({})
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const name = localStorage.getItem('participantName') ?? ''
    setMyName(name)

    const load = async () => {
      const [{ data: roomData }, { data: voteData }] = await Promise.all([
        supabase.from('rooms').select('recommendations').eq('code', code).single(),
        supabase.from('votes').select('*').eq('room_code', code),
      ])
      if (roomData?.recommendations) {
        const cats = roomData.recommendations as CategoryRecommendation[]
        setGroups(cats)
        // 첫 번째 카테고리 기본 열기
        if (cats.length > 0) setOpenCategories(new Set([cats[0].category]))
      }
      if (voteData) {
        setVotes(voteData as Vote[])
        const mv: Record<string, 'ok' | 'no'> = {}
        ;(voteData as Vote[])
          .filter(v => v.participant_name === name)
          .forEach(v => { mv[v.restaurant_name] = v.vote })
        setMyVotes(mv)
      }
      setLoading(false)
    }
    load()

    const ch = supabase
      .channel(`votes-${code}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `room_code=eq.${code}` },
        p => setVotes(prev => [...prev, p.new as Vote]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'votes', filter: `room_code=eq.${code}` },
        p => setVotes(prev => prev.map(v => v.id === (p.new as Vote).id ? p.new as Vote : v)))
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [code])

  const okCount = (name: string) => votes.filter(v => v.restaurant_name === name && v.vote === 'ok').length
  const noCount = (name: string) => votes.filter(v => v.restaurant_name === name && v.vote === 'no').length

  const allRestaurants = groups.flatMap(g => g.restaurants)
  const winnerEntry = allRestaurants.length > 0
    ? allRestaurants.reduce<{ r: RestaurantItem; ok: number } | null>((best, r) => {
        const ok = okCount(r.name)
        return ok > 0 && (!best || ok > best.ok) ? { r, ok } : best
      }, null)
    : null
  const winnerGroup = winnerEntry
    ? groups.find(g => g.restaurants.some(r => r.name === winnerEntry.r.name))
    : null

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
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

  const kakaoPlaceLink = (r: RestaurantItem) =>
    r.url || `https://map.kakao.com/?q=${encodeURIComponent(r.name)}`

  const kakaoNavLink = (r: RestaurantItem) =>
    r.lat && r.lng
      ? `https://map.kakao.com/link/to/${encodeURIComponent(r.name)},${r.lat},${r.lng}`
      : `https://map.kakao.com/?q=${encodeURIComponent(r.name)}`

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
      {/* 헤더 */}
      <div className="bg-orange-500 text-white py-5 px-4 text-center">
        <p className="text-2xl mb-1">🎉</p>
        <h1 className="text-xl font-black">추천 결과</h1>
        <p className="text-orange-100 text-sm mt-1">카테고리를 눌러 식당을 확인하세요</p>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-3">
        {/* 현재 1위 배너 */}
        {winnerEntry && winnerGroup && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">👑</span>
              <span className="font-bold text-sm">현재 1위</span>
            </div>
            <p className="text-xl font-black mb-0.5">{winnerEntry.r.name}</p>
            <p className="text-yellow-100 text-sm mb-3">OK {winnerEntry.ok}표 · {winnerGroup.category}</p>
            <a
              href={kakaoNavLink(winnerEntry.r)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-white text-orange-500 font-bold px-4 py-2 rounded-xl text-sm shadow-sm"
            >
              🗺️ 카카오맵 길찾기
            </a>
          </div>
        )}

        {/* 카테고리 카드 */}
        {groups.map(group => {
          const isOpen = openCategories.has(group.category)
          const isFullMatch = group.matchCount === group.totalCount
          return (
            <div key={group.category} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 카테고리 헤더 (클릭하면 식당 열림) */}
              <button
                onClick={() => toggleCategory(group.category)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="font-bold text-base">{group.category}</h2>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isFullMatch
                          ? 'bg-green-100 text-green-700'
                          : group.matchCount === 0
                            ? 'bg-red-100 text-red-500'
                            : 'bg-orange-100 text-orange-700'
                      }`}>
                        {isFullMatch ? '✓ 모두 가능' : group.matchCount === 0 ? '❌ 불가' : `${group.matchCount}/${group.totalCount}명`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.menus.map(menu => (
                        <span key={menu} className="bg-orange-50 text-orange-600 text-xs font-medium px-2.5 py-1 rounded-full">
                          {menu}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 pt-0.5 flex-shrink-0">
                    <span className="text-gray-400 text-xs">{group.restaurants.length}곳</span>
                    <span className="text-gray-300 text-base leading-none">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {/* 식당 목록 */}
              {isOpen && (
                <div className="border-t border-gray-50 divide-y divide-gray-50">
                  {group.restaurants.map(r => {
                    const ok = okCount(r.name)
                    const no = noCount(r.name)
                    const myVote = myVotes[r.name]
                    return (
                      <div key={r.name} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-snug">{r.name}</p>
                            {r.address && (
                              <p className="text-gray-400 text-xs mt-0.5 truncate">{r.address}</p>
                            )}
                            {r.distance && (
                              <p className="text-gray-400 text-xs">{formatDistance(r.distance)}</p>
                            )}
                          </div>
                          <a
                            href={kakaoPlaceLink(r)} target="_blank" rel="noopener noreferrer"
                            className="flex-shrink-0 text-xs text-blue-500 font-medium underline mt-0.5"
                          >
                            지도
                          </a>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVote(r.name, 'ok')}
                            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                              myVote === 'ok' ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            👍 OK{ok > 0 ? ` (${ok})` : ''}
                          </button>
                          <button
                            onClick={() => handleVote(r.name, 'no')}
                            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                              myVote === 'no' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            👎 NO{no > 0 ? ` (${no})` : ''}
                          </button>
                        </div>
                      </div>
                    )
                  })}
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
      </div>
    </div>
  )
}
