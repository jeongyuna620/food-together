import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY

  if (!key) {
    return NextResponse.json({ status: 'NO_KEY', message: 'NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수가 없음' })
  }

  try {
    const res = await fetch(
      'https://dapi.kakao.com/v2/local/search/keyword.json?query=신촌+음식점&size=3&page=1',
      { headers: { Authorization: `KakaoAK ${key}` } }
    )
    const data = await res.json()

    return NextResponse.json({
      status: res.ok ? 'OK' : 'API_ERROR',
      httpStatus: res.status,
      keyPrefix: key.slice(0, 6) + '...',
      resultCount: data.documents?.length ?? 0,
      firstPlace: data.documents?.[0]?.place_name ?? null,
      errorType: data.error_type ?? null,
      message: data.message ?? null,
    })
  } catch (e) {
    return NextResponse.json({ status: 'EXCEPTION', error: String(e) })
  }
}
