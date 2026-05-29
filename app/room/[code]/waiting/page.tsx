'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Room, Participant } from '@/types'
import QRCodeComponent from '@/components/QRCode'

export default function WaitingPage() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string).toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myName, setMyName] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [isRecommending, setIsRecommending] = useState(false)
  const [recError, setRecError] = useState('')

  const handleRoomUpdate = useCallback((newRoom: Room) => {
    setRoom(newRoom)
    if (newRoom.status === 'recommending') setIsRecommending(true)
    if (newRoom.status === 'results') router.push(`/room/${code}/results`)
  }, [code, router])

  useEffect(() => {
    setShareUrl(`${window.location.origin}/room/${code}`)

    const stored = localStorage.getItem('participantName') ?? ''
    const host = localStorage.getItem('isHost') === 'true'
    setMyName(stored)
    setIsHost(host)

    const load = async () => {
      const [{ data: roomData }, { data: parts }] = await Promise.all([
        supabase.from('rooms').select('*').eq('code', code).single(),
        supabase.from('participants').select('*').eq('room_code', code).order('created_at'),
      ])
      if (roomData) handleRoomUpdate(roomData as Room)
      if (parts) setParticipants(parts as Participant[])
    }
    load()

    const roomCh = supabase
      .channel(`room-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        p => handleRoomUpdate(p.new as Room))
      .subscribe()

    const partCh = supabase
      .channel(`parts-${code}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `room_code=eq.${code}` },
        p => setParticipants(prev => [...prev, p.new as Participant]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'participants', filter: `room_code=eq.${code}` },
        p => setParticipants(prev => prev.map(x => x.id === (p.new as Participant).id ? p.new as Participant : x)))
      .subscribe()

    return () => {
      supabase.removeChannel(roomCh)
      supabase.removeChannel(partCh)
    }
  }, [code, handleRoomUpdate])

  const handleRecommend = async () => {
    const done = participants.filter(p => p.completed).length
    if (done === 0) return
    setIsRecommending(true)
    setRecError('')
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: code }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? '추천 실패')
      }
    } catch (e: unknown) {
      setRecError(e instanceof Error ? e.message : '추천에 실패했어요. 다시 시도해주세요.')
      setIsRecommending(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const completedCount = participants.filter(p => p.completed).length
  const processing = room?.status === 'recommending' || isRecommending

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 헤더 */}
      <div className="bg-violet-600 text-white py-4 px-4 text-center">
        <p className="text-xs opacity-75 mb-0.5">방 코드</p>
        <p className="text-2xl font-black tracking-[0.3em]">{code}</p>
      </div>

      {/* AI 처리 중 배너 */}
      {processing && (
        <div className="bg-violet-50 border-b border-violet-200 py-3 text-center">
          <p className="text-violet-600 font-medium text-sm animate-pulse">
            🤖 AI가 최적의 식당을 찾고 있어요...
          </p>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 pt-5 space-y-4">
        {/* 참여자 현황 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base">참여 현황</h2>
            <span className="text-sm font-bold text-violet-600">
              {completedCount} / {participants.length}명 완료
            </span>
          </div>

          {participants.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">아직 아무도 없어요</p>
          ) : (
            <ul className="space-y-2">
              {participants.map(p => (
                <li key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${p.completed ? 'bg-green-400' : 'bg-gray-300 animate-pulse'}`} />
                  <span className="flex-1 font-medium text-sm">
                    {p.name}
                    {p.name === myName && <span className="text-xs text-gray-400 ml-1">(나)</span>}
                    {p.name === room?.host_name && <span className="text-xs text-violet-400 ml-1">방장</span>}
                  </span>
                  <span className={`text-xs font-medium ${p.completed ? 'text-green-500' : 'text-gray-400'}`}>
                    {p.completed ? '완료' : '입력 중'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 초대 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-base mb-3">친구 초대</h2>

          <button
            onClick={copyLink}
            className="w-full text-left bg-gray-50 border-2 border-gray-100 rounded-xl p-3 mb-3 active:scale-95 transition-transform"
          >
            <p className="text-xs text-gray-400 mb-1">탭해서 링크 복사</p>
            <p className="text-xs text-gray-600 break-all">{shareUrl}</p>
            {copied && <p className="text-green-500 text-xs mt-1 font-medium">✓ 복사됐어요!</p>}
          </button>

          <div className="flex justify-center">
            <QRCodeComponent value={shareUrl} size={160} />
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">QR코드를 스캔해서 참여</p>
        </section>
      </div>

      {/* 하단 — 방장 전용 */}
      {isHost && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-5 shadow-lg">
          <div className="max-w-md mx-auto">
            {recError && <p className="text-red-500 text-sm text-center mb-2">{recError}</p>}
            {completedCount === 0 ? (
              <p className="text-center text-gray-400 text-sm py-2">
                최소 1명이 완료해야 추천받을 수 있어요
              </p>
            ) : (
              <button
                onClick={handleRecommend}
                disabled={processing}
                className="w-full bg-violet-600 text-white text-lg font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-transform disabled:opacity-60 disabled:scale-100"
              >
                {processing
                  ? '🤖  AI가 추천 중...'
                  : `🍽️  추천받기 (${completedCount}명 기준)`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 비방장 안내 */}
      {!isHost && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-5">
          <p className="text-center text-gray-400 text-sm">
            방장이 &lsquo;추천받기&rsquo;를 누를 때까지 대기 중이에요
          </p>
        </div>
      )}
    </div>
  )
}
