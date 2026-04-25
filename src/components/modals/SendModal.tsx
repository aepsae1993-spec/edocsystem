'use client'
import { useState } from 'react'
import type { Teacher } from '@/types/database'

const DOC_TYPES = ['ประชาสัมพันธ์', 'แจ้งให้ทราบ', 'พิจารณา', 'ดำเนินการ']

interface Props {
  action: string
  teachers: Teacher[]
  initialTitle?: string
  initialNote?: string
  currentDocTarget?: string
  onClose: () => void
  onSuccess: (payload: Record<string, unknown>) => void
}

export default function SendModal({ action, teachers, initialTitle = '', initialNote = '', currentDocTarget = '', onClose, onSuccess }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [note, setNote] = useState(initialNote)
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [docType, setDocType] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [attachFiles, setAttachFiles] = useState<File[]>([])

  const titleMap: Record<string, string> = {
    clerk: 'ส่งให้ผู้อำนวยการพิจารณา',
    director: 'อนุมัติและกำหนดการแจกจ่าย',
    distribute: 'ยืนยันแจกจ่ายเอกสาร',
  }

  const targetLabel = (() => {
    if (!currentDocTarget) return 'ทุกคน'
    const parts = currentDocTarget.split(',').map(s => s.trim())
    if (parts.includes('all') || parts.length === 0) return 'ทุกคน'
    const names = parts.map(id => teachers.find(t => t.id === id)?.name || id).filter(Boolean).join(', ')
    return names || 'ทุกคน'
  })()

  async function handleSubmit() {
    if (!title.trim()) return alert('กรุณาระบุชื่อเรื่องของเอกสาร')
    if (action === 'director' && !docType) return alert('กรุณาเลือกประเภทเอกสาร')

    const attachmentDataList: Array<{ data: string; name: string; mime: string }> = []
    for (const file of attachFiles) {
      const data = await new Promise<string>(res => {
        const r = new FileReader()
        r.onload = e => res((e.target?.result as string).split(',')[1])
        r.readAsDataURL(file)
      })
      attachmentDataList.push({ data, name: file.name, mime: file.type })
    }

    const notifyTarget = action === 'director'
      ? (selectedTeachers.length > 0 ? selectedTeachers : ['all'])
      : []

    onSuccess({
      title: title.trim(),
      note: note.trim(),
      targetTeachers: notifyTarget,
      docType: action === 'director' ? docType : undefined,
      urgent: urgent ? 'ด่วนมาก' : '',
      attachmentDataList,
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

          {/* Title - clerk and director */}
          {(action === 'clerk' || action === 'director') && (
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
          )}

          {/* Distribute: show title read-only */}
          {action === 'distribute' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-400 font-semibold uppercase mb-1">เรื่อง</p>
              <p className="text-sm font-semibold text-slate-800">{title}</p>
            </div>
          )}

          {/* Doc type - director only */}
          {action === 'director' && (
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 text-sm">ประเภทเอกสาร <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {DOC_TYPES.map(t => (
                  <label key={t} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${docType === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <input type="radio" name="docType" value={t} checked={docType === t} onChange={() => setDocType(t)} className="accent-indigo-600" />
                    <span className="text-sm font-medium">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notify target - director only */}
          {action === 'director' && (
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 text-sm">แจ้งเตือนใคร</label>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {[{ id: 'all', name: '📢 ทุกคน', department: '' }, ...teachers].map(t => (
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
              <p className="text-xs text-slate-400">ถ้าไม่เลือก = แจ้งเตือนทุกคน</p>
            </div>
          )}

          {/* Distribute: show who will be notified (read-only) */}
          {action === 'distribute' && (
            <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="text-xl">📢</span>
              <div>
                <p className="text-xs text-indigo-500 font-semibold uppercase">จะแจ้งเตือน</p>
                <p className="text-sm font-bold text-indigo-800">{targetLabel}</p>
              </div>
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

          {/* Urgent - distribute only */}
          {action === 'distribute' && (
            <label className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl cursor-pointer">
              <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="w-5 h-5 accent-red-600" />
              <span className="font-bold text-red-700 text-sm">🔴 เอกสารด่วนมาก <span className="font-normal text-red-500">(แจ้งเตือนซ้ำทุก 2 ชม.)</span></span>
            </label>
          )}

          {/* Attachment - clerk and distribute */}
          {(action === 'clerk' || action === 'distribute') && (
            <div className="flex flex-col gap-1.5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <label className="font-semibold text-slate-700 text-sm">📎 ไฟล์แนบเพิ่มเติม <span className="text-xs font-normal text-slate-400">(เลือกได้หลายไฟล์)</span></label>
              <input
                type="file"
                multiple
                onChange={e => setAttachFiles(e.target.files ? Array.from(e.target.files) : [])}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
              />
              {attachFiles.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1">
                  {attachFiles.map((f, i) => (
                    <li key={i} className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>📄 {f.name}</span>
                      <button type="button" onClick={() => setAttachFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
                    </li>
                  ))}
                </ul>
              )}
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
