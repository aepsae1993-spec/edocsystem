import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { broadcastToGroups, pushMessage } from '@/lib/line'

// ส่งขอให้ GAS อัปโหลดไฟล์ขึ้น Google Drive แทน
async function uploadViaDriveGAS(
  base64Data: string,
  fileName: string,
  mimeType: string = 'application/pdf'
): Promise<string> {
  const gasUrl = process.env.GAS_DRIVE_UPLOAD_URL
  if (!gasUrl) throw new Error('GAS_DRIVE_UPLOAD_URL not configured')

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.GAS_SECRET_KEY,
      action: 'uploadFile',
      fileData: base64Data,
      fileName,
      mimeType,
    }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message || 'GAS upload failed')
  return json.fileUrl as string
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const db = createServiceClient()

    let fileUrl = payload.existingFileUrl || ''
    let attachmentUrl = payload.existingAttachmentUrl || ''

    // อัปโหลดไฟล์หลักผ่าน GAS → Google Drive
    if (payload.fileData) {
      fileUrl = await uploadViaDriveGAS(
        payload.fileData,
        payload.fileName || `EDOC_${payload.docNo.replace('/', '_')}.pdf`
      )
    }

    // อัปโหลดไฟล์แนบ
    if (payload.attachmentData) {
      attachmentUrl = await uploadViaDriveGAS(
        payload.attachmentData,
        payload.attachmentName || 'attachment',
        payload.attachmentMimeType || 'application/octet-stream'
      )
    }

    // กำหนดสถานะ
    const statusMap: Record<string, string> = {
      clerk: 'รอ ผอ. พิจารณา',
      director: 'อนุมัติแล้ว (รอแจกจ่าย)',
      distribute: 'แจกจ่ายแล้ว',
    }
    const status = statusMap[payload.action] || 'รอ ผอ. พิจารณา'
    const targetString = (payload.targetTeachers?.length > 0)
      ? payload.targetTeachers.join(',')
      : ''

    if (payload.action === 'clerk' && !payload.docId) {
      // สร้างเอกสารใหม่
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
      // อัปเดตเอกสารเดิม
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (payload.title) updateData.title = payload.title
      if (payload.note !== undefined) updateData.note = payload.note
      if (fileUrl) updateData.file_url = fileUrl
      if (attachmentUrl) updateData.attachment_url = attachmentUrl
      if (targetString) updateData.target = targetString
      if (payload.trackingData) updateData.tracking_data = JSON.parse(payload.trackingData)
      if (payload.urgent !== undefined) updateData.urgent = payload.urgent

      const { error } = await db.from('documents').update(updateData).eq('id', payload.docId)
      if (error) throw new Error(error.message)
    }

    // ดึง Group IDs ทั้งหมด
    const { data: groups } = await db
      .from('line_groups')
      .select('group_id')
      .eq('status', 'active')
    const groupIds = (groups || []).map((g) => g.group_id)

    // ยิง LINE notification
    if (payload.action === 'distribute') {
      const urgentPrefix = payload.urgent ? '🔴 ด่วนมาก! ' : '🔔 '
      let msg = `${urgentPrefix}มีเอกสารแจกจ่าย\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}\nหมายเหตุ: ${payload.note || '-'}`
      if (fileUrl) msg += `\nเอกสาร: ${fileUrl}`
      if (attachmentUrl) msg += `\nไฟล์แนบ: ${attachmentUrl}`
      await broadcastToGroups(groupIds, msg)

      // ส่งส่วนตัวถึงครูแต่ละคน
      const isAll = payload.targetTeachers?.includes('all')
      const { data: teachers } = await db.from('teachers').select('id, name, line_user_id')
      for (const t of teachers || []) {
        if (!t.line_user_id) continue
        if (!isAll && !payload.targetTeachers?.includes(t.id)) continue
        await pushMessage(
          t.line_user_id,
          `📬 คุณได้รับเอกสารใหม่\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}\n${payload.urgent ? '⚠️ เอกสารด่วนมาก!\n' : ''}กรุณาเข้าระบบเพื่อดำเนินการ`
        )
      }
    } else if (payload.action === 'clerk') {
      await broadcastToGroups(
        groupIds,
        `⚠️ มีเอกสารรอ ผอ. พิจารณา\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}\nหมายเหตุ: ${payload.note || '-'}`
      )
      // แจ้ง ผอ. ส่วนตัว
      const { data: dirSetting } = await db.from('settings').select('value').eq('key', 'DIRECTOR_LINE_USER_ID').single()
      if (dirSetting?.value) {
        await pushMessage(dirSetting.value, `📋 (ถึง ผอ.) มีเอกสารรอพิจารณา\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}`)
      }
    } else if (payload.action === 'director') {
      await broadcastToGroups(groupIds, `✅ ผอ. อนุมัติเอกสารแล้ว\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}`)
      // แจ้งธุรการ
      const { data: clerkSetting } = await db.from('settings').select('value').eq('key', 'CLERK_LINE_USER_ID').single()
      if (clerkSetting?.value) {
        await pushMessage(
          clerkSetting.value,
          `📋 ผอ. อนุมัติเอกสารแล้ว รอแจกจ่าย\nเลขรับ: ${payload.docNo}\nเรื่อง: ${payload.title}`
        )
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึกสำเร็จ' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
