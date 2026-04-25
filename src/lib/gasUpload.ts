export async function uploadToGAS(
  base64Data: string,
  fileName: string,
  mimeType = 'application/pdf'
): Promise<string> {
  const gasUrl = process.env.NEXT_PUBLIC_GAS_DRIVE_UPLOAD_URL
  const secret = process.env.NEXT_PUBLIC_GAS_SECRET_KEY
  if (!gasUrl || !secret) throw new Error('GAS upload URL not configured (NEXT_PUBLIC_GAS_DRIVE_UPLOAD_URL)')

  // Use text/plain to avoid CORS preflight — GAS parses body as JSON manually
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ secret, action: 'uploadFile', fileData: base64Data, fileName, mimeType }),
  })

  if (!res.ok) throw new Error(`GAS responded ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.message || 'GAS upload failed')
  return json.fileUrl as string
}
