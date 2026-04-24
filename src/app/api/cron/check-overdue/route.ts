import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { broadcastToGroups, pushMessage } from '@/lib/line'

// Vercel Cron: เรียกทุก 6 ชั่วโมง (ตั้งใน vercel.json)
export async function GET(req: NextRequest) {
  // ป้องกัน unauthorized call
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const now = new Date()

  const { data: docs } = await db.from('documents').select('*')
  const { data: teachers } = await db.from('teachers').select('*')
  const { data: groups } = await db.from('line_groups').select('group_id').eq('status', 'active')
  const groupIds = (groups || []).map(g => g.group_id)

  // =============================================
  // 1. เอกสารค้างเกิน 24 ชม. (รอ ผอ. หรือ อนุมัติแล้ว)
  // =============================================
  const overdueList: { docNo: string; title: string; hours: number }[] = []

  for (const doc of docs || []) {
    if (!doc.status.includes('รอ ผอ.') && !doc.status.includes('อนุมัติแล้ว')) continue
    if (!doc.created_at) continue
    const diffHours = (now.getTime() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60)
    if (diffHours >= 24) {
      overdueList.push({ docNo: doc.doc_no, title: doc.title, hours: Math.floor(diffHours) })
    }
  }

  if (overdueList.length > 0) {
    let msg = `🚨 เอกสารค้างเกิน 24 ชม. จำนวน ${overdueList.length} รายการ\n━━━━━━━━━━━━━━━━━━━━\n`
    overdueList.forEach((d, i) => {
      msg += `${i + 1}. [${d.docNo}] ${d.title} — ค้าง ${d.hours} ชม.\n`
    })
    msg += '━━━━━━━━━━━━━━━━━━━━\nกรุณาดำเนินการโดยเร็ว'
    await broadcastToGroups(groupIds, msg)
  }

  // =============================================
  // 2. เอกสารด่วนที่ยังมีครูไม่ดำเนินการ
  // =============================================
  for (const doc of docs || []) {
    if (!doc.urgent || !doc.status.includes('แจกจ่าย')) continue
    const targets = (doc.target || '').split(',').map((s: string) => s.trim())
    const isAll = targets.includes('all')
    const tracking = doc.tracking_data || {}

    const unopened: string[] = []
    for (const t of teachers || []) {
      if (!isAll && !targets.includes(t.id)) continue
      if (!tracking[t.id]) unopened.push(t.name)
    }

    if (unopened.length > 0) {
      const urgentMsg = `🔴 เอกสารด่วนมาก! ยังมีผู้ไม่ดำเนินการ\nเลขรับ: ${doc.doc_no}\nเรื่อง: ${doc.title}\n❌ ยังไม่ดำเนินการ: ${unopened.join(', ')}\n⚠️ กรุณาดำเนินการโดยด่วน!`
      await broadcastToGroups(groupIds, urgentMsg)

      // แจ้งส่วนตัวครูที่ยังไม่ดำเนินการ
      for (const t of teachers || []) {
        if (!isAll && !targets.includes(t.id)) continue
        if (tracking[t.id]) continue
        if (t.line_user_id) {
          await pushMessage(t.line_user_id, `🔴 เอกสารด่วนมาก!\nเลขรับ: ${doc.doc_no}\nเรื่อง: ${doc.title}\n⚠️ กรุณาเข้าระบบดำเนินการโดยด่วน!`)
        }
      }
    } else {
      // ทุกคนดำเนินการแล้ว → ลบสถานะด่วน
      await db.from('documents').update({ urgent: '' }).eq('id', doc.id)
    }
  }

  return NextResponse.json({ ok: true, checked: docs?.length || 0, overdueCount: overdueList.length })
}
