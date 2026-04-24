import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = createServiceClient()
    const { data, error } = await db
      .from('documents')
      .select('file_url')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ base64: null })

    const fileUrl = (data as unknown as { file_url: string }).file_url
    if (!fileUrl) return NextResponse.json({ base64: null })

    const gasUrl = process.env.GAS_DRIVE_UPLOAD_URL
    if (!gasUrl) return NextResponse.json({ base64: null })

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.GAS_SECRET_KEY,
        action: 'getFileBase64',
        fileUrl,
      }),
    })
    const json = await res.json()
    return NextResponse.json({ base64: json.base64 || null })
  } catch (e) {
    console.error('base64 route error:', e)
    return NextResponse.json({ base64: null })
  }
}
