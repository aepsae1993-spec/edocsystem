import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type SettingRow = { key: string; value: string }

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db.from('settings').select('key, value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const obj: Record<string, string> = {}
  for (const row of ((data ?? []) as unknown as SettingRow[])) {
    obj[row.key] = row.value
  }
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
