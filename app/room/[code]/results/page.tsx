'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDistance } from '@/lib/utils'
import type { Restaurant, Vote } from '@/types'

export default function ResultsPage() {
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [myName, setMyName] = useState('')
  const [myVotes, setMyVotes] = useState<Record<string, 'ok' | 'no'>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const name = localStorage.getItem('participantName') ?? ''
    setMyName(name)

    const load = async () => {
      const [{ data: roomData }, { data: voteData }] = await Promise.all([
        supabase.from('rooms').select('recommendations').eq('code', code).single(),
        supabase.from('votes').select('*').eq('room_code', code),
      ])
      if (roomData?.recommendations) setRestaurants(roomData.recommendations)
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

  const winner = restaurants.length > 0
    ? restaurants.reduce((best, r) => okCount(r.name) >= okCount(best.name) ? r : best, restaurants[0])
    : null
  const winnerOk = winner ? okCount(winner.name) : 0

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

  const kakaoMapLink = (r: Restaurant) => {
    if (r.url) return r.url
    if (r.lat && r.lng)
      return `https://map.kakao.com/link/to/${encodeURIComponent(r.name)},${r.lat},${r.lng}`
    return `https://map.kakao.com/?q=${encodeURIComponent(r.name)}`
  }

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
        <p className="text-orange-100 text-sm mt-1">마음에 드는 곳에 OK를 눌러주세요</p>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-4">
        {/* 현재 1위 배너 */}
        {winnerOk > 0 && winner && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">👑</span>
              <span className="font-bold text-sm">현재 1위</span>
            </div>
            <p className="text-xl font-black mb-0.5">{winner.name}</p>
            <p className="text-yellow-100 text-sm mb-3">OK {winnerOk}표 · {winner.category}</p>
            <a
              href={kakaoMapLink(winner)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-white text-orange-500 font-bold px-4 py-2 rounded-xl text-sm shadow-sm"
            >
              🗺️ 카카오맵 길찾기
            </a>
          </div>
        )}

        {/* 식당 카드 */}
        {restaurants.map((r, i) => {
          const ok = okCount(r.name)
          const no = noCount(r.name)
          const myVote = myVotes[r.name]
          const totalVoters = ok + no

          return (
            <article key={r.name} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 상단 */}
              <div className="p-4">
                <div className="flex items-start gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-500 font-black text-sm">#{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base leading-tight">{r.name}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {r.category} · {formatDistance(r.distance)}
                    </p>
                    {r.address && <p className="text-gray-400 text-xs mt-0.5 truncate">{r.address}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-orange-500 font-bold text-sm">{r.matchCount}/{r.totalCount}명</p>
                    <p className="text-gray-400 text-xs">조건 충족</p>
                  </div>
                </div>

                {/* AI 추천 이유 */}
                <div className="bg-orange-50 rounded-xl px-3 py-2 mb-3">
                  <p className="text-sm text-gray-700">
                    <span className="text-orange-400 font-bold mr-1">추천</span>{r.reason}
                  </p>
                </div>

                {/* 추천 메뉴 */}
                {r.menus && r.menus.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">추천 메뉴</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.menus.map((menu, mi) => (
                        <span key={mi}
                          className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          {menu}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 투표 바 */}
                {totalVoters > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${(ok / totalVoters) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-green-500 font-medium">OK {ok}</span>
                      <span className="text-xs text-red-400 font-medium">NO {no}</span>
                    </div>
                  </div>
                )}

                {/* 투표 버튼 */}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => handleVote(r.name, 'ok')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                      myVote === 'ok' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                    }`}
                  >
                    👍 OK{ok > 0 ? ` (${ok})` : ''}
                  </button>
                  <button
                    onClick={() => handleVote(r.name, 'no')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                      myVote === 'no' ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                    }`}
                  >
                    👎 NO{no > 0 ? ` (${no})` : ''}
                  </button>
                </div>

                <a
                  href={kakaoMapLink(r)} target="_blank" rel="noopener noreferrer"
                  className="block text-center text-xs text-blue-400 underline"
                >
                  지도에서 보기
                </a>
              </div>
            </article>
          )
        })}

        {restaurants.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">😅</p>
            <p>추천 결과가 없어요</p>
          </div>
        )}
      </div>
    </div>
  )
}
