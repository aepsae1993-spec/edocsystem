import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db.from('teachers').select('*').order('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = createServiceClient()

    // ตรวจ ID ซ้ำ
    const { data: existing } = await db.from('teachers').select('id').eq('id', body.id).single()
    if (existing) return NextResponse.json({ success: false, message: 'รหัสนี้มีอยู่แล้วในระบบ' }, { status: 400 })

    const { error } = await db.from('teachers').insert({
      id: body.id,
      name: body.name,
      department: body.department,
      line_user_id: body.line_user_id || '',
      drive_folder_id: body.drive_folder_id || '',
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, message: 'เพิ่มบุคลากรเรียบร้อยแล้ว' })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
