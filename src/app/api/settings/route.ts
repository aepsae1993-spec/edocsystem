import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db.from('settings').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // แปลงเป็น object เพื่อสะดวกใช้ใน client
  const obj: Record<string, string> = {}
  for (const row of data || []) obj[row.key] = row.value
  return NextResponse.json(obj)
}

export async function PATCH(req: NextRequest) {
  try {
    const updates: Record<string, string> = await req.json()
    const db = createServiceClient()
    for (const [key, value] of Object.entries(updates)) {
      await db.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
    }
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
