import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type Params = { params: { id: string } }

// PATCH: แก้ไขฟิลด์ต่างๆ ของเอกสาร
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json()
    const db = createServiceClient()

    // ถ้าส่ง attachmentData มา ให้ upload ผ่าน GAS ก่อน
    if (body.attachmentData) {
      const gasUrl = process.env.GAS_DRIVE_UPLOAD_URL
      if (gasUrl) {
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: process.env.GAS_SECRET_KEY,
            action: 'uploadFile',
            fileData: body.attachmentData,
            fileName: body.attachmentName || 'attachment',
            mimeType: body.attachmentMimeType || 'application/octet-stream',
          }),
        })
        const json = await res.json()
        if (json.success) body.attachment_url = json.fileUrl
      }
      delete body.attachmentData
      delete body.attachmentName
      delete body.attachmentMimeType
    }

    body.updated_at = new Date().toISOString()
    const { error } = await db.from('documents').update(body).eq('id', params.id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}

// DELETE: ลบเอกสาร
export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const db = createServiceClient()
    const { error } = await db.from('documents').delete().eq('id', params.id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, message: 'ลบเอกสารเรียบร้อยแล้ว' })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
