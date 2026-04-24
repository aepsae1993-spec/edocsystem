import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type Params = { params: { id: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json()
    const db = createServiceClient()

    // ถ้า ID เปลี่ยน ต้อง delete + insert (Supabase ไม่ support update PK)
    if (body.id && body.id !== params.id) {
      const { data: old } = await db.from('teachers').select('*').eq('id', params.id).single()
      if (!old) return NextResponse.json({ success: false, message: 'ไม่พบบุคลากร' }, { status: 404 })
      await db.from('teachers').delete().eq('id', params.id)
      await db.from('teachers').insert({ ...old, ...body })
    } else {
      const { error } = await db.from('teachers').update({
        name: body.name,
        department: body.department,
        line_user_id: body.line_user_id || '',
        drive_folder_id: body.drive_folder_id || '',
        updated_at: new Date().toISOString(),
      }).eq('id', params.id)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ success: true, message: 'อัปเดตข้อมูลเรียบร้อยแล้ว' })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const db = createServiceClient()
    const { error } = await db.from('teachers').delete().eq('id', params.id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, message: 'ลบบุคลากรเรียบร้อยแล้ว' })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
