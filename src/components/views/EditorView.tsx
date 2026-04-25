'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { getPendingFile, clearPendingFile } from '@/lib/pendingFile'
import SendModal from '../modals/SendModal'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fabric: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfjsLib: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jspdf: any
  }
}

interface CanvasItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canvas: any
  hiResScale: number
}

type ToolType = 'select' | 'pen' | 'text'

export default function EditorView() {
  const { state, dispatch, showLoading, showToast, loadDashboard } = useApp()
  const { currentDoc, newGeneratedDocNo, currentUser, allTeachers } = state

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasesRef = useRef<CanvasItem[]>([])
  const canvasEditedRef = useRef(false)
  const colorRef = useRef('#000000')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)
  const pageScalesRef = useRef<number[]>([])
  const [currentTool, setCurrentTool] = useState<ToolType>('select')
  const [drawColor, setDrawColor] = useState('#000000')
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [sendAction, setSendAction] = useState('')
  const [stampGalleryOpen, setStampGalleryOpen] = useState(false)
  const [customDocNo, setCustomDocNo] = useState('')
  const [savedStamps, setSavedStamps] = useState<{ name: string; data: string }[]>([])
  const [libsLoaded, setLibsLoaded] = useState(false)
  const [pageLoadProgress, setPageLoadProgress] = useState('')

  // =============================================
  // LOAD EXTERNAL LIBS (fabric, pdfjs, jspdf)
  // =============================================
  useEffect(() => {
    async function loadLibs() {
      if (typeof window === 'undefined') return
      if (window.fabric && window.pdfjsLib && window.jspdf) { setLibsLoaded(true); return }

      const scripts = [
        { src: 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js', check: () => !!window.fabric },
        { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js', check: () => !!window.pdfjsLib },
        { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', check: () => !!window.jspdf },
      ]

      for (const s of scripts) {
        if (!s.check()) {
          await new Promise<void>((res, rej) => {
            const el = document.createElement('script')
            el.src = s.src
            el.onload = () => res()
            el.onerror = () => rej()
            document.head.appendChild(el)
          })
        }
      }

      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
      }
      setLibsLoaded(true)
    }
    loadLibs()
  }, [])

  // =============================================
  // LOAD SAVED STAMPS FROM LOCALSTORAGE
  // =============================================
  useEffect(() => {
    try {
      const stamps = JSON.parse(localStorage.getItem('savedStamps') || '[]')
      setSavedStamps(stamps)
    } catch { /* */ }
  }, [])

  // =============================================
  // RENDER FILE TO CANVAS
  // =============================================
  const renderFileToEditor = useCallback(async (
    dataUrl: string | ArrayBuffer,
    mimeType: string,
    autoNumber?: string
  ) => {
    if (!libsLoaded || !containerRef.current) return
    const { fabric, pdfjsLib } = window
    containerRef.current.innerHTML = ''
    canvasesRef.current = []

    const isPdf = mimeType === 'application/pdf' || (typeof dataUrl === 'string' && dataUrl.includes('data:application/pdf'))

    if (isPdf) {
      let buffer: ArrayBuffer
      if (dataUrl instanceof ArrayBuffer) {
        buffer = dataUrl
      } else {
        // base64 → ArrayBuffer
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        buffer = bytes.buffer
      }

      const pdfDoc = await pdfjsLib.getDocument(buffer).promise
      pdfDocRef.current = pdfDoc
      pageScalesRef.current = []

      for (let num = 1; num <= pdfDoc.numPages; num++) {
        if (num === 1) {
          showLoading(true, 'กำลังโหลดหน้าแรก...')
        } else {
          setPageLoadProgress(`กำลังโหลดหน้า ${num}/${pdfDoc.numPages}...`)
        }

        const page = await pdfDoc.getPage(num)
        const unscaledVp = page.getViewport({ scale: 1.0 })
        const displayWidth = Math.min(800, window.innerWidth - 40)
        const displayScale = displayWidth / unscaledVp.width
        pageScalesRef.current.push(displayScale)

        // Render at 1x for display (fast)
        const displayVp = page.getViewport({ scale: displayScale })

        const wrapper = document.createElement('div')
        wrapper.className = 'bg-white shadow-lg relative border border-slate-200 mx-auto rounded-lg overflow-hidden'
        const canvasEl = document.createElement('canvas')
        canvasEl.id = `canvas_p${num}`
        wrapper.appendChild(canvasEl)
        containerRef.current!.appendChild(wrapper)

        const fCanvas = new fabric.Canvas(canvasEl.id)
        canvasesRef.current.push({ canvas: fCanvas, hiResScale: 1.0 })
        fCanvas.setWidth(displayVp.width)
        fCanvas.setHeight(displayVp.height)

        const tempC = document.createElement('canvas')
        tempC.width = displayVp.width
        tempC.height = displayVp.height
        await page.render({ canvasContext: tempC.getContext('2d'), viewport: displayVp }).promise

        await new Promise<void>(r => {
          fabric.Image.fromURL(tempC.toDataURL('image/png'), (img: object) => {
            fCanvas.setBackgroundImage(img, fCanvas.renderAll.bind(fCanvas), {
              scaleX: 1,
              scaleY: 1,
            })
            if (autoNumber && num === 1) addAutoRunningText(fCanvas, autoNumber)
            r()
          })
        })

        fCanvas.on('path:created', () => { canvasEditedRef.current = true })

        // Show page 1 immediately, load rest in background
        if (num === 1) {
          showLoading(false)
          await new Promise(r => setTimeout(r, 0))
        }
      }
      setPageLoadProgress('')
    } else {
      // Image
      const wrapper = document.createElement('div')
      wrapper.className = 'bg-white shadow-lg relative border border-slate-200 mx-auto rounded-lg overflow-hidden'
      const canvasEl = document.createElement('canvas')
      canvasEl.id = 'canvas_img1'
      wrapper.appendChild(canvasEl)
      containerRef.current!.appendChild(wrapper)

      const fCanvas = new fabric.Canvas(canvasEl.id)
      canvasesRef.current.push({ canvas: fCanvas, hiResScale: 1 })

      await new Promise<void>(r => {
        const imgObj = new Image()
        imgObj.onload = () => {
          const targetW = Math.min(800, window.innerWidth - 40)
          const scale = imgObj.width > targetW ? targetW / imgObj.width : 1
          fCanvas.setWidth(imgObj.width * scale)
          fCanvas.setHeight(imgObj.height * scale)
          fabric.Image.fromURL(dataUrl as string, (img: object) => {
            fCanvas.setBackgroundImage(img, fCanvas.renderAll.bind(fCanvas), {
              scaleX: fCanvas.width / (img as { width: number }).width,
              scaleY: fCanvas.height / (img as { height: number }).height,
            })
            if (autoNumber) addAutoRunningText(fCanvas, autoNumber)
            r()
          })
        }
        imgObj.src = dataUrl as string
      })

      fCanvas.on('path:created', () => { canvasEditedRef.current = true })
    }

    setCurrentTool('select')
  }, [libsLoaded])

  // =============================================
  // INIT — load file when libs ready
  // =============================================
  useEffect(() => {
    if (!libsLoaded) return

    if (!currentDoc) {
      // New doc — load File from memory (no sessionStorage size limit)
      const pendingFile = getPendingFile()
      if (pendingFile) {
        clearPendingFile()
        canvasEditedRef.current = true
        setCustomDocNo(newGeneratedDocNo)
        pendingFile.arrayBuffer().then(buf => renderFileToEditor(buf, pendingFile.type || 'application/pdf'))
      }
    } else {
      // Existing doc — fetch base64 from server via GAS
      canvasEditedRef.current = false
      showLoading(true, 'กำลังดึงไฟล์ PDF...')
      fetch(`/api/documents/${currentDoc.id}/base64`)
        .then(r => r.json())
        .then(({ base64 }) => {
          if (base64) {
            renderFileToEditor(base64, 'application/pdf')
          } else {
            // fallback: show drive link
            renderFallback()
          }
          showLoading(false)
        })
        .catch(() => { renderFallback(); showLoading(false) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libsLoaded])

  function renderFallback() {
    if (!containerRef.current) return
    containerRef.current.innerHTML = `
      <div class="bg-white p-10 text-center shadow-lg rounded-2xl max-w-2xl mx-auto mt-10 border border-slate-200">
        <h3 class="text-xl font-bold text-slate-800 mb-2">${currentDoc?.title || ''}</h3>
        <p class="text-slate-500 mb-6">เลขรับ: ${currentDoc?.doc_no || ''}</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="${currentDoc?.file_url}" target="_blank" class="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition">📥 ดูเอกสารต้นฉบับ</a>
        </div>
        ${currentDoc?.attachment_url ? `<div class="mt-4"><a href="${currentDoc.attachment_url}" target="_blank" class="text-indigo-600 underline">📎 ดาวน์โหลดไฟล์แนบ</a></div>` : ''}
      </div>`
  }

  // =============================================
  // CANVAS TOOLS
  // =============================================
  function addAutoRunningText(canvas: object & { width: number }, text: string) {
    const { fabric } = window
    const c = canvas as { width: number; add: (o: object) => void; renderAll: () => void }
    const rect = new fabric.Rect({ fill: 'white', width: 170, height: 40, opacity: 0.95, rx: 8, ry: 8 })
    const txt = new fabric.Text(`เลขรับ: ${text}`, { fontFamily: 'Sarabun', fontSize: 22, fill: '#dc2626', left: 12, top: 8 })
    const group = new fabric.Group([rect, txt], {
      left: c.width - 190, top: 20,
      borderColor: '#6366f1', cornerColor: '#6366f1', cornerSize: 8, transparentCorners: false,
    })
    c.add(group)
    c.renderAll()
  }

  function applyTool(tool: ToolType) {
    const { fabric } = window
    if (!fabric) return
    setCurrentTool(tool)
    canvasesRef.current.forEach(({ canvas: c }) => {
      c.isDrawingMode = tool === 'pen'
      if (c.isDrawingMode) {
        c.freeDrawingBrush = new fabric.PencilBrush(c)
        c.freeDrawingBrush.color = colorRef.current
        c.freeDrawingBrush.width = 3
      }
      c.off('mouse:down')
      if (tool === 'text') {
        c.on('mouse:down', (opt: { e: MouseEvent }) => {
          const ptr = c.getPointer(opt.e)
          const textObj = new fabric.IText('พิมพ์ข้อความ...', {
            left: ptr.x, top: ptr.y, fontFamily: 'Sarabun', fill: colorRef.current, fontSize: 24,
          })
          c.add(textObj)
          c.setActiveObject(textObj)
          textObj.enterEditing()
          canvasEditedRef.current = true
          applyTool('select')
        })
      }
    })
  }

  function handleColorChange(color: string) {
    setDrawColor(color)
    colorRef.current = color
    applyTool(currentTool)
  }

  function addStampToCanvas(dataUrl: string) {
    const { fabric } = window
    if (!fabric || canvasesRef.current.length === 0) return
    fabric.Image.fromURL(dataUrl, (img: object & { scale: (n: number) => void; set: (o: object) => void }) => {
      const c = canvasesRef.current[0].canvas
      img.scale(0.5)
      img.set({ left: c.width / 2, top: c.height / 2, originX: 'center', originY: 'center' })
      c.add(img)
      c.setActiveObject(img)
      canvasEditedRef.current = true
    })
    applyTool('select')
  }

  // =============================================
  // EXPORT PDF
  // =============================================
  async function exportCanvasToPdfBase64(): Promise<string | null> {
    if (canvasesRef.current.length === 0) return null
    const { jspdf } = window
    const { jsPDF } = jspdf
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pdf: any = null

    for (let i = 0; i < canvasesRef.current.length; i++) {
      showLoading(true, `กำลังสร้าง PDF หน้า ${i + 1}/${canvasesRef.current.length}...`)
      await new Promise(r => setTimeout(r, 50))
      const { canvas } = canvasesRef.current[i]
      canvas.discardActiveObject()

      let imgData: string
      let exportW: number
      let exportH: number

      if (pdfDocRef.current && pageScalesRef.current[i] !== undefined) {
        // Re-render PDF page at 2x from original for full quality
        const page = await pdfDocRef.current.getPage(i + 1)
        const hiResScale = pageScalesRef.current[i] * 2.0
        const hiResVp = page.getViewport({ scale: hiResScale })
        exportW = hiResVp.width
        exportH = hiResVp.height

        const hiResC = document.createElement('canvas')
        hiResC.width = exportW
        hiResC.height = exportH
        await page.render({ canvasContext: hiResC.getContext('2d')!, viewport: hiResVp }).promise

        // Get annotations only (without background) at 2x
        const origBg = canvas.backgroundImage
        canvas.backgroundImage = null
        canvas.renderAll()
        const annotData = canvas.toDataURL({ format: 'png', multiplier: 2.0 })
        canvas.backgroundImage = origBg
        canvas.renderAll()

        // Composite annotations on top of hi-res PDF
        const ctx = hiResC.getContext('2d')!
        await new Promise<void>(resolve => {
          const annotImg = new Image()
          annotImg.onload = () => { ctx.drawImage(annotImg, 0, 0, exportW, exportH); resolve() }
          annotImg.src = annotData
        })
        imgData = hiResC.toDataURL('image/jpeg', 0.88)
      } else {
        // Image file: use fabric canvas at 2x directly
        canvas.renderAll()
        const exportMultiplier = 2.0
        imgData = canvas.toDataURL({ format: 'jpeg', quality: 0.88, multiplier: exportMultiplier })
        exportW = canvas.width * exportMultiplier
        exportH = canvas.height * exportMultiplier
      }

      const orientation = exportW > exportH ? 'l' : 'p'
      if (i === 0) pdf = new jsPDF(orientation, 'pt', [exportW, exportH])
      else pdf.addPage([exportW, exportH], orientation)
      pdf.addImage(imgData, 'JPEG', 0, 0, exportW, exportH, undefined, 'FAST')
    }
    return pdf ? pdf.output('datauristring').split(',')[1] : null
  }

  // =============================================
  // SUBMIT
  // =============================================
  async function handleSendModalSuccess(payload: Record<string, unknown>) {
    setSendModalOpen(false)
    showLoading(true, 'กำลังเตรียมไฟล์...')

    try {
      const docNo = customDocNo || (currentDoc ? currentDoc.doc_no : newGeneratedDocNo)

      let fileData: string | null = null
      const isNewDoc = sendAction === 'clerk' && !currentDoc
      if (isNewDoc || canvasEditedRef.current) {
        fileData = await exportCanvasToPdfBase64()
      }

      const body = {
        ...payload,
        action: sendAction,
        docId: currentDoc?.id || null,
        docNo,
        sender: currentUser?.name,
        fileData,
        fileName: `EDOC_${docNo.replace('/', '_')}.pdf`,
        existingFileUrl: currentDoc?.file_url || '',
        existingAttachmentUrl: currentDoc?.attachment_url || '',
        trackingData: currentDoc ? JSON.stringify(currentDoc.tracking_data) : null,
      }

      showLoading(true, 'กำลังบันทึกและส่งเอกสาร...')
      const res = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let result: { success: boolean; message?: string }
      try {
        result = JSON.parse(text)
      } catch {
        throw new Error(`เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`)
      }
      showLoading(false)

      if (result.success) {
        showToast('✅ บันทึกและส่งเอกสารสำเร็จ!')
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' })
        setTimeout(() => loadDashboard(), 300)
      } else {
        showToast('❌ ' + result.message, 'error')
      }
    } catch (e) {
      showLoading(false)
      showToast('❌ เกิดข้อผิดพลาด: ' + String(e), 'error')
    }
  }

  async function acknowledgeDocument() {
    if (!currentDoc) return
    showLoading(true, 'กำลังบันทึก...')
    await fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: currentDoc.id, userId: currentUser?.id, status: 'acknowledged' }),
    })
    showLoading(false)
    showToast('✅ รับทราบเรียบร้อย')
    dispatch({ type: 'SET_VIEW', payload: 'dashboard' })
    setTimeout(() => loadDashboard(), 300)
  }

  async function completeDocument() {
    if (!currentDoc) return
    showLoading(true, 'กำลังบันทึก...')
    await fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: currentDoc.id, userId: currentUser?.id, status: 'completed' }),
    })
    showLoading(false)
    showToast('✅ เสร็จสิ้นแล้ว')
    dispatch({ type: 'SET_VIEW', payload: 'dashboard' })
    setTimeout(() => loadDashboard(), 300)
  }

  // =============================================
  // STAMP GALLERY
  // =============================================
  function handleStampUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const newStamp = { name: file.name, data: ev.target?.result as string }
      const updated = [...savedStamps, newStamp]
      setSavedStamps(updated)
      localStorage.setItem('savedStamps', JSON.stringify(updated))
      showToast('✅ บันทึกรูปเรียบร้อย')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function deleteStamp(idx: number) {
    if (!confirm('ลบรูปนี้?')) return
    const updated = savedStamps.filter((_, i) => i !== idx)
    setSavedStamps(updated)
    localStorage.setItem('savedStamps', JSON.stringify(updated))
  }

  // =============================================
  // EDITOR HEADER BUTTONS — per role
  // =============================================
  const isNewDoc = !currentDoc
  const docNo = customDocNo || currentDoc?.doc_no || newGeneratedDocNo
  const docTracking = currentDoc?.tracking_data || {}
  const myTrackStatus = currentUser?.role === 'teacher' ? docTracking[currentUser.id!] : undefined

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 z-30">
      {/* Page load progress bar */}
      {pageLoadProgress && (
        <div className="bg-indigo-600 text-white text-xs text-center py-1 px-3 shrink-0 animate-pulse">
          ⏳ {pageLoadProgress}
        </div>
      )}
      {/* Header */}
      <header className="glass border-b border-slate-200/80 shrink-0 shadow-sm z-20">
        <div className="h-12 sm:h-14 flex items-center justify-between px-2 sm:px-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
              className="text-slate-500 hover:bg-slate-100 px-2 sm:px-3 py-1.5 rounded-xl flex items-center gap-1 font-medium transition text-sm shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              <span className="hidden sm:inline">กลับ</span>
            </button>
            <div className="flex items-center gap-2 border-l border-slate-300 pl-2 sm:pl-4 min-w-0">
              {currentUser?.role === 'clerk' && isNewDoc ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 shrink-0">เลขรับ:</span>
                  <input
                    type="text"
                    value={customDocNo}
                    onChange={e => setCustomDocNo(e.target.value)}
                    className="w-28 sm:w-36 text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-300 focus:outline-none focus:border-indigo-500"
                    placeholder="001/2569"
                  />
                  <button
                    onClick={() => { if (customDocNo.trim()) addAutoRunningText(canvasesRef.current[0]?.canvas, customDocNo.trim()) }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-lg font-bold transition whitespace-nowrap"
                    title="ประทับเลขรับบนเอกสาร"
                  >
                    🔢 ประทับ
                  </button>
                </div>
              ) : (
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 truncate">
                  เลขรับ: {docNo}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto shrink-0">
            {/* Clerk: ส่ง ผอ. (new doc) */}
            {currentUser?.role === 'clerk' && isNewDoc && (
              <button onClick={() => { setSendAction('clerk'); setSendModalOpen(true) }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition">
                ส่งให้ ผอ. ➡️
              </button>
            )}
            {/* Clerk: แจกจ่าย (approved doc) */}
            {currentUser?.role === 'clerk' && currentDoc?.status.includes('อนุมัติ') && (
              <button onClick={() => { setSendAction('distribute'); setSendModalOpen(true) }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition">
                แจกจ่ายครู 📢
              </button>
            )}
            {/* Director: อนุมัติ */}
            {currentUser?.role === 'director' && currentDoc?.status.includes('รอ ผอ.') && (
              <button onClick={() => { setSendAction('director'); setSendModalOpen(true) }} className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition">
                ลงนาม & อนุมัติ ✅
              </button>
            )}
            {/* Teacher: รับทราบ */}
            {currentUser?.role === 'teacher' && (!myTrackStatus || myTrackStatus === 'read') && (
              <button onClick={acknowledgeDocument} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition">
                รับทราบ ✅
              </button>
            )}
            {/* Teacher: เสร็จสิ้น */}
            {currentUser?.role === 'teacher' && myTrackStatus === 'acknowledged' && (
              <button onClick={completeDocument} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition">
                เสร็จสิ้น ✅
              </button>
            )}
            {/* Teacher: ดู Drive */}
            {currentUser?.role === 'teacher' && currentDoc?.file_url && (
              <a href={currentDoc.file_url} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition">
                📂 Drive
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tools */}
        <aside className="w-12 sm:w-16 bg-white border-r border-slate-200 flex flex-col items-center py-2 sm:py-4 gap-2 sm:gap-3 shrink-0 z-10 shadow-sm overflow-y-auto">
          {(['select', 'pen', 'text'] as ToolType[]).map(tool => {
            const icons: Record<ToolType, React.ReactNode> = {
              select: <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>,
              pen: <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
              text: <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
            }
            return (
              <button
                key={tool}
                className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl text-slate-600 hover:bg-slate-100 transition ${currentTool === tool ? 'active-tool' : ''}`}
                onClick={() => applyTool(tool)}
                title={tool}
              >
                {icons[tool]}
              </button>
            )
          })}
          <div className="w-6 sm:w-8 h-px bg-slate-200 my-0.5" />
          <input
            type="color"
            value={drawColor}
            onChange={e => handleColorChange(e.target.value)}
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl cursor-pointer border-2 border-slate-200 p-0.5"
          />
          <button
            onClick={() => setStampGalleryOpen(true)}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-center text-xs font-bold leading-tight transition"
            title="เพิ่มตรา"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[9px] sm:text-[10px]">ตรา</span>
          </button>
        </aside>

        {/* Canvas area */}
        <main
          className="flex-1 overflow-auto p-2 sm:p-8 flex justify-center items-start"
          style={{ background: 'radial-gradient(circle at center, #f1f5f9 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          <div ref={containerRef} className="flex flex-col gap-4 sm:gap-8 origin-top pb-20 items-center w-full" />
        </main>
      </div>

      {/* Send Modal */}
      {sendModalOpen && (
        <SendModal
          action={sendAction}
          teachers={allTeachers}
          initialTitle={currentDoc?.title || ''}
          initialNote={currentDoc?.note || ''}
          currentDocTarget={currentDoc?.target || ''}
          onClose={() => setSendModalOpen(false)}
          onSuccess={handleSendModalSuccess}
        />
      )}

      {/* Stamp Gallery Modal */}
      {stampGalleryOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-fadeInUp">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">🖼️ คลังรูปตรา / ลายเซ็น</h3>
              <button onClick={() => setStampGalleryOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <label className="block w-full mb-4 cursor-pointer">
                <div className="border-2 border-dashed border-indigo-300 rounded-xl p-4 text-center hover:bg-indigo-50 transition">
                  <span className="text-sm font-semibold text-indigo-600">+ อัพโหลดรูปใหม่ (บันทึกไว้ใช้ครั้งต่อไป)</span>
                </div>
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleStampUpload} />
              </label>
              {savedStamps.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">ยังไม่มีรูปที่บันทึกไว้</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {savedStamps.map((stamp, idx) => (
                    <div
                      key={idx}
                      className="relative group border-2 border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-400 transition bg-white aspect-square flex items-center justify-center p-2"
                      onClick={() => { addStampToCanvas(stamp.data); setStampGalleryOpen(false) }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stamp.data} className="max-w-full max-h-full object-contain" alt={stamp.name} />
                      <button
                        onClick={e => { e.stopPropagation(); deleteStamp(idx) }}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition hover:bg-red-600 flex items-center justify-center"
                      >&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
