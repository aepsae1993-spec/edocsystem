// Auto-compress PDF attachments before upload.
// Uses window.pdfjsLib + window.jspdf (loaded lazily if not already present).

const PDF_JS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'
const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
const JSPDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

const MAX_B64 = 3.5 * 1024 * 1024
const QUALITY_STEPS = [0.88, 0.75, 0.60, 0.45]

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function ensureLibs() {
  const w = window as Window & { pdfjsLib?: { GlobalWorkerOptions: { workerSrc: string } }; jspdf?: unknown }
  if (!w.pdfjsLib) {
    await loadScript(PDF_JS_SRC)
    if (w.pdfjsLib) w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC
  }
  if (!w.jspdf) await loadScript(JSPDF_SRC)
}

export async function compressPdfIfNeeded(
  base64: string,
  mimeType: string,
  onProgress?: (msg: string) => void
): Promise<{ data: string; compressed: boolean }> {
  if (mimeType !== 'application/pdf' || base64.length <= MAX_B64) {
    return { data: base64, compressed: false }
  }

  try {
    await ensureLibs()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const pdfjsLib = w.pdfjsLib
    const jsPDF = w.jspdf?.jsPDF
    if (!pdfjsLib || !jsPDF) return { data: base64, compressed: false }

    // Decode base64 → ArrayBuffer
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const pdfDoc = await pdfjsLib.getDocument(bytes.buffer).promise

    // Render all pages to HTMLCanvasElements at display scale (kept for quality retries)
    type PageEl = { el: HTMLCanvasElement; w: number; h: number }
    const pages: PageEl[] = []
    for (let num = 1; num <= pdfDoc.numPages; num++) {
      onProgress?.(`กำลังเตรียมหน้า ${num}/${pdfDoc.numPages}...`)
      const page = await pdfDoc.getPage(num)
      const unscaledVp = page.getViewport({ scale: 1.0 })
      const scale = Math.min(1.0, 800 / unscaledVp.width)
      const vp = page.getViewport({ scale })
      const el = document.createElement('canvas')
      el.width = vp.width; el.height = vp.height
      await page.render({ canvasContext: el.getContext('2d')!, viewport: vp }).promise
      pages.push({ el, w: vp.width, h: vp.height })
    }

    // Try quality steps until size fits
    for (let qi = 0; qi < QUALITY_STEPS.length; qi++) {
      const quality = QUALITY_STEPS[qi]
      onProgress?.(qi === 0
        ? 'กำลังบีบอัดไฟล์แนบ...'
        : `กำลังลดขนาดต่อ (คุณภาพ ${Math.round(quality * 100)}%)...`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pdf: any = null
      for (const { el, w, h } of pages) {
        const imgData = el.toDataURL('image/jpeg', quality)
        const orientation = w > h ? 'l' : 'p'
        if (!pdf) pdf = new jsPDF(orientation, 'pt', [w, h])
        else pdf.addPage([w, h], orientation)
        pdf.addImage(imgData, 'JPEG', 0, 0, w, h, undefined, 'FAST')
      }

      const b64: string = pdf.output('datauristring').split(',')[1]
      if (b64.length <= MAX_B64 || qi === QUALITY_STEPS.length - 1) {
        return { data: b64, compressed: true }
      }
    }
  } catch {
    // compression failed — return original and let upload handle it
  }

  return { data: base64, compressed: false }
}
