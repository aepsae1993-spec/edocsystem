'use client'
import type { Document, Teacher } from '@/types/database'

interface Props {
  doc: Document
  teachers: Teacher[]
  onClose: () => void
}

export default function TrackingModal({ doc, teachers, onClose }: Props) {
  const targets = (doc.target || '').split(',').map(s => s.trim())
  const isAll = targets.includes('all')
  const tracking = doc.tracking_data || {}

  const list = isAll ? teachers : teachers.filter(t => targets.includes(t.id))

  let done = 0, acked = 0, read = 0, unread = 0
  list.forEach(t => {
    const st = tracking[t.id]
    if (st === 'completed') done++
    else if (st === 'acknowledged') acked++
    else if (st === 'read') read++
    else unread++
  })

  const percent = list.length > 0 ? Math.round(done / list.length * 100) : 0

  function statusBadge(teacherId: string) {
    const st = tracking[teacherId]
    if (st === 'completed') return <span className="status-badge text-emerald-600 bg-emerald-50 border border-emerald-200">🎉 เสร็จสิ้น</span>
    if (st === 'acknowledged') return <span className="status-badge text-indigo-600 bg-indigo-50 border border-indigo-200">✅ รับทราบ</span>
    if (st === 'read') return <span className="status-badge text-blue-600 bg-blue-50 border border-blue-200">👁️ เปิดอ่าน</span>
    return <span className="status-badge text-amber-600 bg-amber-50 border border-amber-200">📄 ยังไม่อ่าน</span>
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden mx-4 flex flex-col max-h-[80vh] animate-fadeInUp">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-slate-800">📊 ติดตามสถานะ</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">&times;</button>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-4 text-xs font-medium text-slate-500 shrink-0 flex-wrap">
          <span className="text-emerald-600">✅ เสร็จ {done}</span>
          <span className="text-indigo-600">📋 รับทราบ {acked}</span>
          <span className="text-blue-600">👁️ เปิดอ่าน {read}</span>
          <span className="text-amber-600">📄 ยังไม่อ่าน {unread}</span>
          <span className="ml-auto font-bold text-slate-700">{percent}% สำเร็จ</span>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="p-3 font-semibold text-slate-500 text-xs uppercase border-b border-slate-200">ชื่อบุคลากร</th>
                <th className="p-3 font-semibold text-slate-500 text-xs uppercase border-b border-slate-200 w-36">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={2} className="p-6 text-center text-slate-400">ไม่มีรายชื่อผู้รับ</td></tr>
              ) : list.map(t => (
                <tr key={t.id} className="table-row border-b border-slate-100">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">{t.name.charAt(0)}</div>
                      <div>
                        <div className="font-medium text-slate-700">{t.name}</div>
                        <div className="text-xs text-slate-400">{t.department}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{statusBadge(t.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button onClick={onClose} className="px-5 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition text-sm">ปิด</button>
        </div>
      </div>
    </div>
  )
}
