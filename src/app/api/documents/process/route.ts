import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { broadcastToGroups, pushMessage } from '@/lib/line'

type TeacherRow = { id: string; name: string; line_user_id: string }
type GroupRow = { group_id: string }
type SettingRow = { value: string }
type DocRow = { target: string; doc_type: string }

async function uploadViaDriveGAS(base64Data: string, fileName: string, mimeType = 'application/pdf'): Promise<string> {
  const gasUrl = process.env.GAS_DRIVE_UPLOAD_URL
  if (!gasUrl) throw new Error('GAS_DRIVE_UPLOAD_URL not configured')
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.GAS_SECRET_KEY, action: 'uploadFile', fileData: base64Data, fileName, mimeType }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message || 'GAS upload failed')
  return json.fileUrl as string
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const db = createServiceClient()

    let fileUrl: string = payload.existingFileUrl || ''
    if (payload.fileData) {
      fileUrl = await uploadViaDriveGAS(
        payload.fileData,
        payload.fileName || `EDOC_${String(payload.docNo).replace('/', '_')}.pdf`
      )
    }

    const existingAttachUrls = (payload.existingAttachmentUrl as string || '').split('\n').filter(Boolean)
    const newAttachUrls: string[] = []
    if (Array.isArray(payload.attachmentDataList)) {
      for (const item of payload.attachmentDataList as Array<{ data: string; name: string; mime: string }>) {
        const url = await uploadViaDriveGAS(item.data, item.name, item.mime || 'application/octet-stream')
        newAttachUrls.push(url)
      }
    } else if (payload.attachmentData) {
      const url = await uploadViaDriveGAS(payload.attachmentData as string, (payload.attachmentName as string) || 'attachment', (payload.attachmentMimeType as string) || 'application/octet-stream')
      newAttachUrls.push(url)
    }
    const attachmentUrl = [...existingAttachUrls, ...newAttachUrls].join('\n')

    const statusMap: Record<string, string> = {
      clerk: 'รอ ผอ. พิจารณา',
      director: 'อนุมัติแล้ว (รอแจกจ่าย)',
      distribute: 'แจกจ่ายแล้ว',
    }
    const status = statusMap[payload.action as string] || 'รอ ผอ. พิจารณา'

    // target string — director sets this; distribute does NOT override
    const targetString =
      payload.targetTeachers?.length > 0 ? (payload.targetTeachers as string[]).join(',') : ''

    if (payload.action === 'clerk' && !payload.docId) {
      const newId = `DOC_${Date.now()}`
      const { error } = await db.from('documents').insert({
        id: newId,
        doc_no: payload.docNo,
        title: payload.title,
        sender: payload.sender,
        status,
        file_url: fileUrl,
        attachment_url: attachmentUrl,
        note: payload.note || '',
        target: targetString,
        tracking_data: {},
        urgent: payload.urgent || '',
      })
      if (error) throw new Error(error.message)
    } else {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (payload.title) updateData.title = payload.title
      if (payload.note !== undefined) updateData.note = payload.note
      if (fileUrl) updateData.file_url = fileUrl
      if (attachmentUrl) updateData.attachment_url = attachmentUrl
      // Only update target when director sets it (not during distribute)
      if (targetString && payload.action !== 'distribute') updateData.target = targetString
      if (payload.trackingData) updateData.tracking_data = JSON.parse(payload.trackingData as string)
      if (payload.urgent !== undefined) updateData.urgent = payload.urgent
      // Save doc_type when director approves
      if (payload.docType) updateData.doc_type = payload.docType

      const { error } = await db.from('documents').update(updateData).eq('id', payload.docId)
      if (error) throw new Error(error.message)
    }

    // Group IDs
    const { data: groupsRaw } = await db
      .from('line_groups')
      .select('group_id')
      .eq('status', 'active')
    const groupIds = ((groupsRaw ?? []) as unknown as GroupRow[]).map(g => g.group_id)

    // LINE notifications
    if (payload.action === 'distribute') {
      // Fetch target & doc_type set by director
      const { data: existingDocRaw } = await db
        .from('documents')
        .select('target, doc_type')
        .eq('id', payload.docId)
        .single()
      const existingDoc = existingDocRaw as unknown as DocRow | null
      const docTarget = existingDoc?.target || 'all'
      const docType = existingDoc?.doc_type || ''

      const targetParts = docTarget.split(',').map((s: string) => s.trim())
      const isAll = targetParts.includes('all') || targetParts.length === 0 || docTarget === ''

      // Fetch teachers once (for name lookup + push)
      const { data: teachersRaw } = await db.from('teachers').select('id, name, line_user_id')
      const teachers = ((teachersRaw ?? []) as unknown as TeacherRow[])
      const teacherNameMap: Record<string, string> = {}
      teachers.forEach(t => { teacherNameMap[t.id] = t.name })

      const urgentPrefix = payload.urgent ? '🔴 ด่วนมาก! ' : '🔔 '
      const targetLabel = isAll
        ? 'ทุกคน'
        : targetParts.map(id => teacherNameMap[id] || id).join(', ')
      const docTypeLine = docType ? `\nประเภท: ${docType}` : ''
      const attachParts = attachmentUrl.split('\n').filter(Boolean)

      let msg = `${urgentPrefix}มีเอกสารแจกจ่าย${docTypeLine}\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}\nแจ้งเตือน: ${targetLabel}\nหมายเหตุ: ${payload.note || '-'}`
      if (fileUrl) msg += `\nเอกสาร: ${fileUrl}`
      attachParts.forEach((u, i) => {
        msg += `\nไฟล์แนบ${attachParts.length > 1 ? ` ${i + 1}` : ''}: ${u}`
      })
      await broadcastToGroups(groupIds, msg)

      for (const t of teachers) {
        if (!t.line_user_id) continue
        if (!isAll && !targetParts.includes(t.id)) continue
        await pushMessage(
          t.line_user_id,
          `📬 คุณได้รับเอกสารใหม่${docTypeLine}\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}\n${payload.urgent ? '⚠️ เอกสารด่วนมาก!\n' : ''}กรุณาเข้าระบบเพื่อดำเนินการ`
        )
      }
    } else if (payload.action === 'clerk') {
      await broadcastToGroups(
        groupIds,
        `⚠️ มีเอกสารรอ ผอ. พิจารณา\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}\nหมายเหตุ: ${payload.note || '-'}`
      )
      const { data: dirRaw } = await db
        .from('settings')
        .select('value')
        .eq('key', 'DIRECTOR_LINE_USER_ID')
        .single()
      const dirSetting = dirRaw as unknown as SettingRow | null
      if (dirSetting?.value) {
        await pushMessage(
          dirSetting.value,
          `📋 (ถึง ผอ.) มีเอกสารรอพิจารณา\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}`
        )
      }
    } else if (payload.action === 'director') {
      const docTypeLine = payload.docType ? `\nประเภท: ${payload.docType}` : ''
      await broadcastToGroups(
        groupIds,
        `✅ ผอ. อนุมัติเอกสารแล้ว${docTypeLine}\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}`
      )
      const { data: clerkRaw } = await db
        .from('settings')
        .select('value')
        .eq('key', 'CLERK_LINE_USER_ID')
        .single()
      const clerkSetting = clerkRaw as unknown as SettingRow | null
      if (clerkSetting?.value) {
        await pushMessage(
          clerkSetting.value,
          `📋 ผอ. อนุมัติเอกสารแล้ว รอแจกจ่าย${docTypeLine}\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}`
        )
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึกสำเร็จ' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
