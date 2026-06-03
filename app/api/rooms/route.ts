import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

export async function POST(req: NextRequest) {
  try {
    const { host_name, location, lat, lng } = await req.json()
    if (!host_name?.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 })
    }

    let code = generateCode()
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.from('rooms').select('code').eq('code', code).maybeSingle()
      if (!data) break
      code = generateCode()
    }

    const insertData: Record<string, unknown> = {
      code,
      host_name: host_name.trim(),
      location: location?.trim() ?? '',
      status: 'waiting',
    }
    // lat/lng는 GPS 모드일 때만 포함 (컬럼 없는 환경에서도 텍스트 입력은 동작하도록)
    if (lat != null) insertData.lat = lat
    if (lng != null) insertData.lng = lng

    const { error } = await supabase.from('rooms').insert(insertData)
    if (error) throw error

    return NextResponse.json({ code })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: '방 생성에 실패했습니다' }, { status: 500 })
  }
}
