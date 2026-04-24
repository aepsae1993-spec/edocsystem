'use client'
import { useState } from 'react'
import { useApp } from '@/lib/store'

interface Props {
  mode: 'add' | 'edit'
  initialData?: Record<string, unknown>
  onClose: () => void
  onSuccess: () => void
}

export default function TeacherEditModal({ mode, initialData, onClose, onSuccess }: Props) {
  const { showLoading, showToast } = useApp()
  const [id, setId] = useState((initialData?.id as string) || '')
  const [name, setName] = useState((initialData?.name as string) || '')
  const [dept, setDept] = useState((initialData?.department as string) || '')
  const [lineId, setLineId] = useState((initialData?.line_user_id as string) || '')
  const [driveId, setDriveId] = useState((initialData?.drive_folder_id as string) || '')

  const originalId = (initialData?.id as string) || ''

  async function handleSave() {
    if (!id.trim() || !name.trim() || !dept.trim()) {
      showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบ', 'error')
      return
    }
    showLoading(true, 'กำลังบันทึก...')
    const body = { id: id.trim(), name: name.trim(), department: dept.trim(), line_user_id: lineId.trim(), drive_folder_id: driveId.trim() }

    let res
    if (mode === 'add') {
      res = await fetch('/api/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      res = await fetch(`/api/teachers/${originalId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    const result = await res.json()
    showLoading(false)
    if (result.success) { showToast('✅ ' + result.message); onSuccess() }
    else showToast('❌ ' + result.message, 'error')
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden mx-4 animate-fadeInUp">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{mode === 'add' ? '➕ เพิ่มบุคลากรใหม่' : '✏️ แก้ไขข้อมูลบุคลากร'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">&times;</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 text-sm">รหัส (ID) <span className="text-red-500">*</span></label>
              <input value={id} onChange={e => setId(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="เช่น t4" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 text-sm">ชื่อ-สกุล <span className="text-red-500">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="ครูสมศรี" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">หมวดวิชา / แผนก <span className="text-red-500">*</span></label>
            <input value={dept} onChange={e => setDept(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="คณิตศาสตร์" />
          </div>
          <div className="flex flex-col gap-1.5 p-4 bg-green-50/50 border border-green-100 rounded-xl">
            <label className="font-semibold text-slate-700 text-sm">📲 LINE User ID</label>
            <input value={lineId} onChange={e => setLineId(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none" placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            <p className="text-[10px] text-slate-400">พิมพ์ id ในแชทกับ LINE OA เพื่อรับ User ID</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-700 text-sm">📁 Drive Folder ID (ส่วนตัว)</label>
            <input value={driveId} onChange={e => setDriveId(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="(ไม่บังคับ)" />
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition text-sm">ยกเลิก</button>
          <button onClick={handleSave} className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl shadow-sm transition text-sm">💾 บันทึก</button>
        </div>
      </div>
    </div>
  )
}
