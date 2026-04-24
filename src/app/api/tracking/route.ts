import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const STATUS_LEVEL: Record<string, number> = { read: 1, acknowledged: 2, completed: 3 }

export async function POST(req: NextRequest) {
  try {
    const { docId, userId, status } = await req.json()
    const db = createServiceClient()

    const { data, error } = await db
      .from('documents')
      .select('tracking_data')
      .eq('id', docId)
      .single()

    if (error || !data) throw new Error('ไม่พบเอกสาร')

    const tracking = (data.tracking_data as Record<string, string>) || {}
    const currentLevel = STATUS_LEVEL[tracking[userId]] || 0
    const newLevel = STATUS_LEVEL[status] || 0

    // ไม่ downgrade สถานะ
    if (newLevel >= currentLevel) {
      tracking[userId] = status
      const { error: updateError } = await db
        .from('documents')
        .update({ tracking_data: tracking, updated_at: new Date().toISOString() })
        .eq('id', docId)
      if (updateError) throw new Error(updateError.message)
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
