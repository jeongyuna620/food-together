'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type LocationMode = 'text' | 'gps'
interface GpsResult { name: string; lat: number; lng: number }

export default function HomePage() {
  const router = useRouter()

  const [showForm, setShowForm]       = useState(false)
  const [hostName, setHostName]       = useState('')
  const [locationMode, setLocationMode] = useState<LocationMode>('text')
  const [location, setLocation]       = useState('')
  const [gpsLoading, setGpsLoading]   = useState(false)
  const [gpsDetected, setGpsDetected] = useState<GpsResult | null>(null)
  const [gpsError, setGpsError]       = useState('')
  const [isCreating, setIsCreating]   = useState(false)
  const [error, setError]             = useState('')

  const detectGps = async () => {
    setGpsLoading(true)
    setGpsError('')
    setGpsDetected(null)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      )
      const { latitude: lat, longitude: lng } = pos.coords
      const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`,
        { headers: { Authorization: `KakaoAK ${key}` } }
      )
      const data = await res.json()
      const region = (data.documents ?? []).find(
        (d: { region_type: string }) => d.region_type === 'H'
      ) ?? data.documents?.[0]
      const name = region
        ? `${region.region_2depth_name} ${region.region_3depth_name}`.trim()
        : '현재 위치'
      setGpsDetected({ name, lat, lng })
    } catch {
      setGpsError('위치를 가져올 수 없습니다. 직접 입력을 이용해주세요.')
    }
    setGpsLoading(false)
  }

  const isLocationReady =
    locationMode === 'text' ? location.trim().length > 0 : gpsDetected !== null

  const handleCreate = async () => {
    if (!hostName.trim() || !isLocationReady) return
    setIsCreating(true)
    setError('')

    const locationText = locationMode === 'gps' ? gpsDetected!.name : location.trim()
    const lat = locationMode === 'gps' ? gpsDetected!.lat : null
    const lng = locationMode === 'gps' ? gpsDetected!.lng : null

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_name: hostName.trim(), location: locationText, lat, lng }),
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
            각자의 취향을 입력하면<br />딱 맞는 식당을 추천해줘요
          </p>
        </div>

        {/* 방 만들기 */}
        {showForm ? (
          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <h2 className="font-bold text-xl text-center mb-4">방 만들기</h2>

            {/* 이름 */}
            <label className="block text-sm font-semibold text-gray-600 mb-0.5">방장 이름</label>
            <p className="text-xs text-gray-400 mb-1.5">본인 이름을 입력하세요. 결과 화면에 표시됩니다.</p>
            <input
              type="text"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="이름 입력"
              maxLength={12}
              autoFocus
              className="w-full border-2 border-gray-100 rounded-2xl p-3 text-base font-medium focus:outline-none focus:border-violet-400 mb-5"
            />

            {/* 약속 장소 */}
            <label className="block text-sm font-semibold text-gray-600 mb-2">약속 장소</label>

            {/* 모드 탭 */}
            <div className="flex rounded-xl border-2 border-gray-100 overflow-hidden mb-3">
              <button
                type="button"
                onClick={() => { setLocationMode('text'); setGpsDetected(null); setGpsError('') }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  locationMode === 'text' ? 'bg-violet-600 text-white' : 'bg-gray-50 text-gray-400'
                }`}
              >
                직접 입력
              </button>
              <button
                type="button"
                onClick={() => { setLocationMode('gps'); setError('') }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  locationMode === 'gps' ? 'bg-violet-600 text-white' : 'bg-gray-50 text-gray-400'
                }`}
              >
                📍 현재 위치
              </button>
            </div>

            {/* 직접 입력 */}
            {locationMode === 'text' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="동네명 또는 지하철역명 입력"
                  maxLength={30}
                  className="w-full border-2 border-gray-100 rounded-2xl p-3 text-base font-medium focus:outline-none focus:border-violet-400"
                />
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  예: 신촌, 성수, 강남역<br />
                  건물·학교명보다 인근 역명이 더 정확합니다
                </p>
              </div>
            )}

            {/* GPS */}
            {locationMode === 'gps' && (
              <div className="mb-4">
                {!gpsDetected ? (
                  <button
                    type="button"
                    onClick={detectGps}
                    disabled={gpsLoading}
                    className="w-full border-2 border-dashed border-violet-200 text-violet-500 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                  >
                    {gpsLoading ? '위치 감지 중...' : '📍 현재 위치 감지하기'}
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-violet-50 border-2 border-violet-200 rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-xs text-violet-400 mb-0.5">감지된 위치</p>
                      <p className="text-sm font-bold text-violet-700">📍 {gpsDetected.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGpsDetected(null)}
                      className="text-xs text-gray-400 underline"
                    >
                      재감지
                    </button>
                  </div>
                )}
                {gpsError && <p className="text-red-500 text-xs mt-2 text-center">{gpsError}</p>}
                <p className="text-xs text-gray-400 mt-1.5 text-center">
                  약속 장소에 도착한 후 감지하세요
                </p>
              </div>
            )}

            {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={!hostName.trim() || !isLocationReady || isCreating}
              className="w-full bg-violet-600 text-white text-lg font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100"
            >
              {isCreating ? '생성 중...' : '방 만들기'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(''); setGpsDetected(null); setGpsError('') }}
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
