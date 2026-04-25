'use client'
import { useState } from 'react'
import { useApp } from '@/lib/store'
import type { Document, Teacher } from '@/types/database'

interface Props {
  doc: Document
  teachers: Teacher[]
  onClose: () => void
  onSuccess: () => void
}

export default function AdminEditModal({ doc, teachers, onClose, onSuccess }: Props) {
  const { showLoading, showToast } = useApp()
  const [docNo, setDocNo] = useState(doc.doc_no)
  const [title, setTitle] = useState(doc.title)
  const [note, setNote] = useState(doc.note)
  const [selectedTargets, setSelectedTargets] = useState<string[]>(
    doc.target ? doc.target.split(',').map(s => s.trim()) : []
  )
  const [attachFile, setAttachFile] = useState<File | null>(null)

  function toggleTarget(id: string) {
    setSelectedTargets(prev =>
      id === 'all'
        ? prev.includes('all') ? [] : ['all']
        : prev.includes(id) ? prev.filter(x => x !== id) : [...prev.filter(x => x !== 'all'), id]
    )
  }

  async function handleSave() {
    showLoading(true, 'กำลังบันทึก...')
    const body: Record<string, unknown> = {
      doc_no: docNo.trim(),
      title: title.trim(),
      note: note.trim(),
      target: selectedTargets.join(','),
    }

    if (attachFile) {
      body.attachmentData = await new Promise(res => {
        const r = new FileReader()
        r.onload = e => res((e.target?.result as string).split(',')[1])
        r.readAsDataURL(attachFile!)
      })
      body.attachmentName = attachFile.name
      body.attachmentMimeType = attachFile.type
    }

    const res = await fetch(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await res.json()
    showLoading(false)
    if (result.success) { showToast('✅ บันทึกการแก้ไขเรียบร้อย'); onSuccess() }
    else showToast('❌ ' + result.message, 'error')
  }

  async function handleDelete() {
    if (!confirm('⚠️ ยืนยันลบเอกสารนี้? ไม่สามารถย้อนกลับได้')) return
    onClose()
    showLoading(true, 'กำลังลบ...')
    await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    showLoading(false)
    showToast('✅ ลบเอกสารเรียบร้อย')
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden mx-4 animate-fadeInUp">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">🛠️ แก้ไขเอกสาร</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">&times;</button>
        </div>
        <div className="p-6 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">เลขรับ / เลขคำสั่ง</label>
            <div className="flex gap-2">
              <input value={docNo} onChange={e => setDocNo(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              <button type="button" onClick={() => setDocNo('')} className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-100 transition whitespace-nowrap">🗑️ ล้าง</button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">ชื่อเอกสาร</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">หมายเหตุ</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">ครูผู้รับ (เป้าหมาย)</label>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
              {[{ id: 'all', name: '📢 ทุกคน', department: '' }, ...teachers].map(t => (
                <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                  <input type="checkbox" checked={selectedTargets.includes(t.id)} onChange={() => toggleTarget(t.id)} className="accent-indigo-600 w-4 h-4" />
                  <span className="text-sm">{t.name} {t.department ? `(${t.department})` : ''}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <label className="font-semibold text-slate-700 text-sm">📎 เปลี่ยนไฟล์แนบ</label>
            <input type="file" onChange={e => setAttachFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer" />
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={handleDelete} className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition text-sm">🗑️ ลบเอกสาร</button>
          <button onClick={handleSave} className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-sm transition text-sm">💾 บันทึก</button>
        </div>
      </div>
    </div>
  )
}
