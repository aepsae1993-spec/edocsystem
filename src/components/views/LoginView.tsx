'use client'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useApp } from '@/lib/store'
import type { CurrentUser } from '@/types/database'

export default function LoginView() {
  const { state, dispatch, showLoading, showToast, loadTeachers } = useApp()
  const [teacherListLoaded, setTeacherListLoaded] = useState(false)

  const ensureTeachersLoaded = useCallback(async () => {
    if (teacherListLoaded) return
    await loadTeachers()
    setTeacherListLoaded(true)
  }, [teacherListLoaded, loadTeachers])

  async function proceedLogin(userObj: CurrentUser) {
    dispatch({ type: 'SET_USER', payload: userObj })
    dispatch({ type: 'SET_TAB', payload: '' })
    dispatch({ type: 'SET_VIEW', payload: 'dashboard' })
    showLoading(true, 'กำลังดึงข้อมูลเอกสาร...')
    const res = await fetch('/api/documents')
    const data = await res.json()
    dispatch({ type: 'SET_DOCS', payload: data })
    showLoading(false)
  }

  async function login(role: 'admin' | 'clerk' | 'director') {
    const roleMap: Record<string, CurrentUser> = {
      admin: { role: 'admin', name: 'ผู้ดูแลระบบ', badge: 'bg-slate-800 text-white' },
      clerk: { role: 'clerk', name: 'งานธุรการ', badge: 'bg-indigo-100 text-indigo-700' },
      director: { role: 'director', name: 'ผู้อำนวยการ', badge: 'bg-purple-100 text-purple-700' },
    }
    if (role === 'clerk' || role === 'director') await ensureTeachersLoaded()
    await proceedLogin(roleMap[role])
  }

  async function loginAsTeacher() {
    await ensureTeachersLoaded()
    const sel = document.getElementById('loginTeacherSelect') as HTMLSelectElement
    if (!sel?.value) return showToast('กรุณาเลือกชื่อของคุณก่อนเข้าสู่ระบบ', 'error')
    const teacher = state.allTeachers.find(t => t.id === sel.value)
    if (!teacher) return
    await proceedLogin({ role: 'teacher', id: teacher.id, name: teacher.name, badge: 'bg-emerald-100 text-emerald-700' })
  }

  const schoolName = state.settings['SCHOOL_NAME'] || 'E-Document System'

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #3730a3 60%, #4338ca 100%)' }}
    >
      <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative bg-white/95 backdrop-blur-xl p-6 sm:p-10 rounded-3xl shadow-luxe w-full max-w-lg text-center mx-4 animate-fadeInUp border border-white/60">

        {/* Logo โรงเรียน */}
        <div className="flex justify-center mb-4">
          {state.schoolLogoUrl ? (
            <div className="w-20 h-20 relative rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/20 border-2 border-indigo-100">
              <Image
                src={state.schoolLogoUrl}
                alt="โลโก้โรงเรียน"
                fill
                className="object-contain p-1"
                onError={() => {}} // ถ้าโหลดไม่ได้ ไม่ crash
              />
            </div>
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/40 rotate-3">
              <svg className="w-10 h-10 -rotate-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gradient mb-1">{schoolName}</h1>
        <p className="text-slate-500 mb-8 text-sm sm:text-base">ระบบสารบรรณอิเล็กทรอนิกส์</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {([
            { role: 'admin' as const, emoji: '🛠️', label: 'แอดมิน', cls: 'bg-slate-50 border-slate-200 hover:border-slate-400 text-slate-700' },
            { role: 'clerk' as const, emoji: '👩‍💼', label: 'ธุรการ', cls: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 text-indigo-700' },
            { role: 'director' as const, emoji: '👨‍💼', label: 'ผู้อำนวยการ', cls: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-700' },
          ] as const).map(({ role, emoji, label, cls }) => (
            <button
              key={role}
              onClick={() => login(role)}
              className={`p-5 border-2 rounded-2xl font-bold transition-all card-hover ${cls}`}
            >
              <div className="text-3xl mb-2">{emoji}</div>
              <div className="text-base sm:text-lg">{label}</div>
            </button>
          ))}
        </div>

        <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl text-left">
          <span className="font-bold text-emerald-800 flex items-center gap-2 mb-3 text-base">
            <span className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-sm">👨‍🏫</span>
            เข้าสู่ระบบครู / บุคลากร
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              id="loginTeacherSelect"
              onFocus={ensureTeachersLoaded}
              className="flex-1 p-3 rounded-xl border border-emerald-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- คลิกเพื่อโหลดรายชื่อ --</option>
              {state.allTeachers.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
              ))}
            </select>
            <button
              onClick={loginAsTeacher}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-3 font-bold transition shadow-sm text-base"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
