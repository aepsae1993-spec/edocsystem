import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const db = createServiceClient()
    const { count } = await db.from('documents').select('*', { count: 'exact', head: true })
    const nextNo = (count || 0) + 1
    const currentYear = new Date().getFullYear() + 543
    const docNo = `${String(nextNo).padStart(3, '0')}/${currentYear}`
    return NextResponse.json({ docNo })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
