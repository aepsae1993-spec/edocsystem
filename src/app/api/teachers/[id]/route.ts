import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type TeacherRow = {
  id: string
  name: string
  department: string
  line_user_id: string
  drive_folder_id: string
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: originalId } = await params
    const body = await req.json()
    const db = createServiceClient()

    if (body.id && body.id !== originalId) {
      const { data: old } = await db.from('teachers').select('*').eq('id', originalId).single()
      if (!old) return NextResponse.json({ success: false, message: 'ไม่พบบุคลากร' }, { status: 404 })
      await db.from('teachers').delete().eq('id', originalId)
      await db.from('teachers').insert({ ...(old as unknown as TeacherRow), ...body })
    } else {
      const { error } = await db.from('teachers').update({
        name: body.name,
        department: body.department,
        line_user_id: body.line_user_id || '',
        drive_folder_id: body.drive_folder_id || '',
        updated_at: new Date().toISOString(),
      }).eq('id', originalId)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ success: true, message: 'อัปเดตข้อมูลเรียบร้อยแล้ว' })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = createServiceClient()
    const { error } = await db.from('teachers').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, message: 'ลบบุคลากรเรียบร้อยแล้ว' })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
