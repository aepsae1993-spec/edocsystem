'use client'
import { useState } from 'react'
import type { Teacher } from '@/types/database'

interface Props {
  action: string
  teachers: Teacher[]
  initialTitle?: string
  initialNote?: string
  onClose: () => void
  onSuccess: (payload: Record<string, unknown>) => void
}

export default function SendModal({ action, teachers, initialTitle = '', initialNote = '', onClose, onSuccess }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [note, setNote] = useState(initialNote)
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [urgent, setUrgent] = useState(false)
  const [attachFile, setAttachFile] = useState<File | null>(null)

  const titleMap: Record<string, string> = {
    clerk: 'ส่งให้ผู้อำนวยการพิจารณา',
    director: 'อนุมัติและส่งกลับธุรการ',
    distribute: 'แจกจ่ายเอกสารให้บุคลากร',
  }

  async function handleSubmit() {
    if (!title.trim()) return alert('กรุณาระบุชื่อเรื่องของเอกสาร')

    let attachmentData: string | null = null
    let attachmentName: string | null = null
    let attachmentMimeType: string | null = null

    if (attachFile) {
      attachmentData = await new Promise(res => {
        const r = new FileReader()
        r.onload = e => res((e.target?.result as string).split(',')[1])
        r.readAsDataURL(attachFile)
      })
      attachmentName = attachFile.name
      attachmentMimeType = attachFile.type
    }

    const targets = selectedTeachers.length === 0 ? [] : selectedTeachers
    onSuccess({
      title: title.trim(),
      note: note.trim(),
      targetTeachers: action === 'distribute' ? (targets.length > 0 ? targets : ['all']) : [],
      urgent: urgent ? 'ด่วนมาก' : '',
      attachmentData,
      attachmentName,
      attachmentMimeType,
    })
  }

  function toggleTeacher(id: string) {
    setSelectedTeachers(prev =>
      id === 'all'
        ? prev.includes('all') ? [] : ['all']
        : prev.includes(id) ? prev.filter(x => x !== id) : [...prev.filter(x => x !== 'all'), id]
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden mx-4 animate-fadeInUp">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{titleMap[action] || 'ดำเนินการ'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">&times;</button>
        </div>

        <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">เรื่อง / ชื่อเอกสาร <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
              placeholder="ระบุชื่อเรื่อง..."
            />
          </div>

          {/* Teacher select (distribute) */}
          {action === 'distribute' && (
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 text-sm">เลือกครูผู้รับ</label>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {[{ id: 'all', name: '📢 แจ้งเตือนทุกคน', department: '' }, ...teachers].map(t => (
                  <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                    <input
                      type="checkbox"
                      checked={selectedTeachers.includes(t.id)}
                      onChange={() => toggleTeacher(t.id)}
                      className="accent-indigo-600 w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">{t.name} {t.department ? `(${t.department})` : ''}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400">ถ้าไม่เลือก = แจกจ่ายทุกคน</p>
            </div>
          )}

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">หมายเหตุ / ข้อความสั่งการ</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none transition"
              placeholder="พิมพ์ข้อความเพิ่มเติม..."
            />
          </div>

          {/* Urgent */}
          {action === 'distribute' && (
            <label className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl cursor-pointer">
              <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="w-5 h-5 accent-red-600" />
              <span className="font-bold text-red-700 text-sm">🔴 เอกสารด่วนมาก <span className="font-normal text-red-500">(แจ้งเตือนซ้ำทุก 2 ชม.)</span></span>
            </label>
          )}

          {/* Attachment */}
          {(action === 'clerk' || action === 'distribute') && (
            <div className="flex flex-col gap-1.5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <label className="font-semibold text-slate-700 text-sm">📎 ไฟล์แนบเพิ่มเติม</label>
              <input
                type="file"
                onChange={e => setAttachFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition text-sm">ยกเลิก</button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl shadow-sm transition text-sm"
          >
            ยืนยัน & ส่ง
          </button>
        </div>
      </div>
    </div>
  )
}
