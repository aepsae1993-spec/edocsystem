import { NextRequest, NextResponse } from 'next/server'

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
    const { fileData, fileName, mimeType } = await req.json()
    if (!fileData || !fileName) return NextResponse.json({ success: false, message: 'Missing fileData or fileName' }, { status: 400 })
    const fileUrl = await uploadViaDriveGAS(fileData, fileName, mimeType || 'application/octet-stream')
    return NextResponse.json({ success: true, fileUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
