'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  const [showForm, setShowForm]     = useState(false)
  const [hostName, setHostName]     = useState('')
  const [location, setLocation]     = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError]           = useState('')

  const handleCreate = async () => {
    if (!hostName.trim() || !location.trim()) return
    setIsCreating(true)
    setError('')

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
      localStorage.setItem('lastRoomCode', data.code)
      router.push(`/room/${data.code}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '다시 시도해주세요')
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-600 to-purple-700 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* 히어로 */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🍽️</div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Eatween</h1>
          <p className="text-violet-200 text-base leading-relaxed">
            각자의 조건을 입력하면<br />딱 맞는 식당을 추천해줘요
          </p>
        </div>

        {/* 방 만들기 */}
        {showForm ? (
          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <h2 className="font-bold text-xl text-center mb-4">방 만들기</h2>

            {/* 방장 이름 */}
            <label className="block text-sm font-semibold text-gray-600 mb-0.5">방장 이름</label>
            <p className="text-xs text-gray-400 mb-1.5">본인 이름을 입력하세요. 결과 화면에 표시됩니다.</p>
            <input
              type="text"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="이름 입력"
              maxLength={12}
              autoFocus
              className="w-full border-2 border-gray-100 rounded-2xl p-3 text-base font-medium focus:outline-none focus:border-violet-400 mb-4"
            />

            {/* 약속 장소 */}
            <label className="block text-sm font-semibold text-gray-600 mb-0.5">약속 장소</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="동네명 또는 지하철역명 입력"
              maxLength={30}
              className="w-full border-2 border-gray-100 rounded-2xl p-3 text-base font-medium focus:outline-none focus:border-violet-400"
            />
            <p className="text-xs text-gray-400 mt-1.5 mb-4 leading-relaxed">
              예: 신촌, 성수, 홍대입구역<br />
              건물·학교명보다 인근 역명이 더 정확합니다
            </p>

            {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={!hostName.trim() || !location.trim() || isCreating}
              className="w-full bg-violet-600 text-white text-lg font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100"
            >
              {isCreating ? '생성 중...' : '방 만들기'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="w-full mt-2 text-gray-400 py-2 text-sm"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-white text-violet-600 text-xl font-black py-5 rounded-3xl shadow-2xl active:scale-95 transition-transform"
          >
            🏠 방 만들기
          </button>
        )}

        <p className="text-violet-300 text-xs text-center mt-8">
          방을 만들고 링크를 공유하면<br />친구들이 바로 참여할 수 있어요
        </p>
      </div>
    </div>
  )
}
