import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type Params = { params: { id: string } }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('documents')
      .select('file_url')
      .eq('id', params.id)
      .single()

    if (error || !data?.file_url) return NextResponse.json({ base64: null })

    // ดึง file_url แล้วส่งต่อให้ GAS ดึง base64 จาก Drive
    const gasUrl = process.env.GAS_DRIVE_UPLOAD_URL
    if (!gasUrl) return NextResponse.json({ base64: null })

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.GAS_SECRET_KEY,
        action: 'getFileBase64',
        fileUrl: data.file_url,
      }),
    })
    const json = await res.json()
    return NextResponse.json({ base64: json.base64 || null })
  } catch (e) {
    console.error('base64 route error:', e)
    return NextResponse.json({ base64: null })
  }
}
