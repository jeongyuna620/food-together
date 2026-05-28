'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  CANT_EAT_OPTIONS, DONT_WANT_OPTIONS, BUDGET_OPTIONS,
  SPICY_OPTIONS, MOOD_OPTIONS, CRAVING_OPTIONS,
} from '@/lib/utils'
import type { Room } from '@/types'

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string).toUpperCase()

  const [roomStatus, setRoomStatus] = useState<'loading' | 'notfound' | 'ok'>('loading')
  const [room, setRoom] = useState<Room | null>(null)

  const [name, setName] = useState('')
  const [cantEat, setCantEat] = useState<string[]>([])
  const [dontWant, setDontWant] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [spicy, setSpicy] = useState('normal')
  const [mood, setMood] = useState('any')
  const [craving, setCraving] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const checkAndRedirect = useCallback(async () => {
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()

    if (!roomData) { setRoomStatus('notfound'); return }
    if (roomData.status === 'results') { router.replace(`/room/${code}/results`); return }

    setRoom(roomData as Room)
    setRoomStatus('ok')

    const storedName = localStorage.getItem('participantName')
    if (storedName) {
      setName(storedName)
      const { data: existing } = await supabase
        .from('participants')
        .select('completed')
        .eq('room_code', code)
        .eq('name', storedName)
        .single()
      if (existing?.completed) { router.replace(`/room/${code}/waiting`) }
    }
  }, [code, router])

  useEffect(() => { checkAndRedirect() }, [checkAndRedirect])

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('이름을 입력해주세요'); return }
    if (!budget) { setError('예산을 선택해주세요'); return }
    setError('')
    setIsSubmitting(true)

    try {
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('room_code', code)
        .eq('name', name.trim())
        .maybeSingle()

      const payload = {
        cant_eat: cantEat,
        dont_want: dontWant,
        budget,
        spicy,
        mood,
        craving,
        completed: true,
      }

      if (existing) {
        await supabase.from('participants').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('participants').insert({ room_code: code, name: name.trim(), ...payload })
      }

      localStorage.setItem('participantName', name.trim())
      router.push(`/room/${code}/waiting`)
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      setIsSubmitting(false)
    }
  }

  if (roomStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-orange-400 text-lg animate-pulse">로딩 중...</p>
      </div>
    )
  }

  if (roomStatus === 'notfound') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="text-5xl mb-4">😢</div>
        <p className="text-gray-500 text-lg font-medium">존재하지 않는 방이에요</p>
        <button onClick={() => router.push('/')} className="mt-4 text-orange-500 underline text-sm">홈으로 가기</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* 헤더 */}
      <div className="bg-orange-500 text-white py-4 px-4 text-center sticky top-0 z-10">
        <p className="text-xs opacity-75 mb-0.5">방 코드</p>
        <p className="text-2xl font-black tracking-[0.3em]">{code}</p>
        {room?.location && <p className="text-orange-100 text-xs mt-1">📍 {room.location}</p>}
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-4">

        {/* 이름 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-3">이름</h2>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="표시될 이름을 입력하세요" maxLength={12}
            className="w-full border-2 border-gray-100 rounded-xl p-3 text-base focus:outline-none focus:border-orange-400"
          />
        </section>

        {/* 못 먹는 것 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-1">못 먹는 것</h2>
          <p className="text-xs text-gray-400 mb-3">해당 없으면 그냥 넘어가세요</p>
          <div className="grid grid-cols-3 gap-2">
            {CANT_EAT_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => toggle(cantEat, setCantEat, opt.id)}
                className={`py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  cantEat.includes(opt.id) ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 text-gray-600'
                }`}>
                {cantEat.includes(opt.id) ? '✕ ' : ''}{opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 오늘 먹기 싫은 것 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-1">오늘 먹기 싫은 것</h2>
          <p className="text-xs text-gray-400 mb-3">해당 없으면 그냥 넘어가세요</p>
          <div className="grid grid-cols-2 gap-2">
            {DONT_WANT_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => toggle(dontWant, setDontWant, opt.id)}
                className={`py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  dontWant.includes(opt.id) ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-100 bg-gray-50 text-gray-600'
                }`}>
                {dontWant.includes(opt.id) ? '✕ ' : ''}{opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 오늘 땡기는 것 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-1">오늘 땡기는 것</h2>
          <p className="text-xs text-gray-400 mb-3">있으면 골라주세요</p>
          <div className="grid grid-cols-2 gap-2">
            {CRAVING_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setCraving(opt.id)}
                className={`py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-colors text-left ${
                  craving === opt.id ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-600'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 매운 음식 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-3">매운 음식</h2>
          <div className="grid grid-cols-3 gap-2">
            {SPICY_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setSpicy(opt.id)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  spicy === opt.id ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-gray-50 text-gray-600'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 식사 스타일 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-3">오늘 식사 스타일</h2>
          <div className="space-y-2">
            {MOOD_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setMood(opt.id)}
                className={`w-full py-3 px-4 rounded-xl border-2 text-left font-medium text-sm transition-colors ${
                  mood === opt.id ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-gray-50 text-gray-600'
                }`}>
                {mood === opt.id && '✓ '}{opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 예산 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-3">예산 (1인 기준)</h2>
          <div className="space-y-2">
            {BUDGET_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setBudget(opt.id)}
                className={`w-full py-3 px-4 rounded-xl border-2 text-left font-medium text-sm transition-colors ${
                  budget === opt.id ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-gray-50 text-gray-600'
                }`}>
                {budget === opt.id && '✓ '}{opt.label}
              </button>
            ))}
          </div>
        </section>

      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-5 shadow-lg">
        <div className="max-w-md mx-auto">
          {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="w-full bg-orange-500 text-white text-lg font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100">
            {isSubmitting ? '저장 중...' : '완료'}
          </button>
        </div>
      </div>
    </div>
  )
}
