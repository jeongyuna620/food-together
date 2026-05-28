import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase()
  const { data, error } = await supabase
    .from('rooms')
    .select('code, status')
    .eq('code', code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '존재하지 않는 방이에요' }, { status: 404 })
  }

  return NextResponse.json(data)
}
