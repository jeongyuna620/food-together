'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  // 방 만들기
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hostName, setHostName] = useState('')
  const [location, setLocation] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // 코드로 입장
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const handleCreate = async () => {
    if (!hostName.trim()) return
    setIsCreating(true)
    setCreateError('')

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_name: hostName.trim(),
          location: location.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '방 생성 실패')

      localStorage.setItem('participantName', hostName.trim())
      localStorage.setItem('isHost', 'true')
      router.push(`/room/${data.code}`)
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : '다시 시도해주세요')
      setIsCreating(false)
    }
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 6) { setJoinError('6자리 코드를 입력해주세요'); return }
    setIsJoining(true)
    setJoinError('')

    try {
      const res = await fetch(`/api/rooms/${code}`)
      if (res.status === 404) throw new Error('존재하지 않는 방이에요')
      if (!res.ok) throw new Error('입장 실패. 다시 시도해주세요')

      localStorage.setItem('isHost', 'false')
      router.push(`/room/${code}`)
    } catch (e: unknown) {
      setJoinError(e instanceof Error ? e.message : '다시 시도해주세요')
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-400 to-orange-500 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* 히어로 */}
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🍽️</div>
          <h1 className="text-4xl font-black text-white mb-2">오늘 뭐먹지?</h1>
          <p className="text-orange-100 text-base leading-relaxed">
            각자의 취향을 입력하면<br />딱 맞는 식당을 추천해줘요
          </p>
        </div>

        {/* 방 만들기 */}
        {showCreateForm ? (
          <div className="bg-white rounded-3xl p-6 shadow-2xl mb-4">
            <h2 className="font-bold text-xl text-center mb-4">방 만들기</h2>

            <label className="block text-sm font-semibold text-gray-600 mb-1">이름</label>
            <input
              type="text"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="친구들에게 보일 이름"
              maxLength={12}
              autoFocus
              className="w-full border-2 border-gray-100 rounded-2xl p-3 text-base font-medium focus:outline-none focus:border-orange-400 mb-4"
            />

            <label className="block text-sm font-semibold text-gray-600 mb-1">
              약속 장소 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="예: 강남역, 홍대입구, 건국대"
              maxLength={30}
              className="w-full border-2 border-gray-100 rounded-2xl p-3 text-base font-medium focus:outline-none focus:border-orange-400 mb-4"
            />

            {createError && <p className="text-red-500 text-sm text-center mb-3">{createError}</p>}

            <button
              onClick={handleCreate}
              disabled={!hostName.trim() || isCreating}
              className="w-full bg-orange-500 text-white text-lg font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              {isCreating ? '생성 중...' : '방 만들기'}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setCreateError('') }}
              className="w-full mt-2 text-gray-400 py-2 text-sm"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowCreateForm(true); setShowJoinForm(false) }}
            className="w-full bg-white text-orange-500 text-xl font-black py-5 rounded-3xl shadow-2xl active:scale-95 transition-transform mb-4"
          >
            🏠 방 만들기
          </button>
        )}

        {/* 코드로 입장 */}
        {showJoinForm ? (
          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <h2 className="font-bold text-xl text-center mb-1">코드로 입장</h2>
            <p className="text-gray-400 text-sm text-center mb-4">친구에게 받은 6자리 코드</p>

            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="예: AB1234"
              maxLength={6}
              autoFocus
              className="w-full border-2 border-gray-100 rounded-2xl p-4 text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:border-orange-400 mb-3 uppercase"
            />

            {joinError && <p className="text-red-500 text-sm text-center mb-3">{joinError}</p>}

            <button
              onClick={handleJoin}
              disabled={joinCode.length < 6 || isJoining}
              className="w-full bg-orange-500 text-white text-lg font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              {isJoining ? '확인 중...' : '입장하기'}
            </button>
            <button
              onClick={() => { setShowJoinForm(false); setJoinCode(''); setJoinError('') }}
              className="w-full mt-2 text-gray-400 py-2 text-sm"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowJoinForm(true); setShowCreateForm(false) }}
            className="w-full bg-white/20 text-white text-xl font-black py-5 rounded-3xl border-2 border-white/40 active:scale-95 transition-transform"
          >
            🔑 코드로 입장
          </button>
        )}

        <p className="text-orange-200 text-xs text-center mt-8">
          방을 만들고 코드를 공유하면<br />친구들이 바로 참여할 수 있어요
        </p>
      </div>
    </div>
  )
}
