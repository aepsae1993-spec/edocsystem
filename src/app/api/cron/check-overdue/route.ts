import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { broadcastToGroups, pushMessage } from '@/lib/line'

interface DocRow {
  id: string
  doc_no: string
  title: string
  status: string
  target: string
  tracking_data: Record<string, string>
  urgent: string
  created_at: string
}
interface TeacherRow {
  id: string
  name: string
  line_user_id: string
}
interface GroupRow {
  group_id: string
}

// Vercel Cron: ทุก 6 ชม.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const now = new Date()

  const { data: docsData } = await db.from('documents').select('*')
  const { data: teachersData } = await db.from('teachers').select('id, name, line_user_id')
  const { data: groupsData } = await db
    .from('line_groups')
    .select('group_id')
    .eq('status', 'active')

  const docs = (docsData ?? []) as unknown as DocRow[]
  const teachers = (teachersData ?? []) as unknown as TeacherRow[]
  const groups = (groupsData ?? []) as unknown as GroupRow[]
  const groupIds = groups.map(g => g.group_id)

  // 1. เอกสารค้างเกิน 24 ชม.
  const overdueList: { docNo: string; title: string; hours: number }[] = []
  for (const doc of docs) {
    if (!doc.status.includes('รอ ผอ.') && !doc.status.includes('อนุมัติแล้ว')) continue
    if (!doc.created_at) continue
    const diffHours = (now.getTime() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60)
    if (diffHours >= 24) {
      overdueList.push({ docNo: doc.doc_no, title: doc.title, hours: Math.floor(diffHours) })
    }
  }

  if (overdueList.length > 0) {
    let msg = `🚨 เอกสารค้างเกิน 24 ชม. จำนวน ${overdueList.length} รายการ\n━━━━━━━━━━━━━━━━━━━━\n`
    overdueList.forEach((d, i) => { msg += `${i + 1}. [${d.docNo}] ${d.title} — ค้าง ${d.hours} ชม.\n` })
    msg += '━━━━━━━━━━━━━━━━━━━━\nกรุณาดำเนินการโดยเร็ว'
    await broadcastToGroups(groupIds, msg)
  }

  // 2. เอกสารด่วนที่ยังมีครูไม่ดำเนินการ
  for (const doc of docs) {
    if (!doc.urgent || !doc.status.includes('แจกจ่าย')) continue
    const targets = (doc.target ?? '').split(',').map((s: string) => s.trim())
    const isAll = targets.includes('all')
    const tracking = (doc.tracking_data ?? {}) as Record<string, string>

    const unopened: string[] = []
    for (const t of teachers) {
      if (!isAll && !targets.includes(t.id)) continue
      if (!tracking[t.id]) unopened.push(t.name)
    }

    if (unopened.length > 0) {
      const urgentMsg = `🔴 เอกสารด่วนมาก!\nเลขรับ: ${doc.doc_no}\nเรื่อง: ${doc.title}\n❌ ยังไม่ดำเนินการ: ${unopened.join(', ')}\n⚠️ ด่วน!`
      await broadcastToGroups(groupIds, urgentMsg)
      for (const t of teachers) {
        if (!isAll && !targets.includes(t.id)) continue
        if (tracking[t.id] || !t.line_user_id) continue
        await pushMessage(t.line_user_id, `🔴 เอกสารด่วนมาก!\nเลขรับ: ${doc.doc_no}\nเรื่อง: ${doc.title}\n⚠️ กรุณาเข้าระบบดำเนินการ!`)
      }
    } else {
      await db.from('documents').update({ urgent: '' }).eq('id', doc.id)
    }
  }

  return NextResponse.json({ ok: true, checked: docs.length, overdueCount: overdueList.length })
}
