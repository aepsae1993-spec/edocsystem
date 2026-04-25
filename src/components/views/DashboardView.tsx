'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useApp } from '@/lib/store'
import type { Document, TeacherSummary } from '@/types/database'
import SendModal from '../modals/SendModal'
import TrackingModal from '../modals/TrackingModal'
import TeacherEditModal from '../modals/TeacherEditModal'
import AdminEditModal from '../modals/AdminEditModal'

// =============================================
// STAT CARDS
// =============================================
function StatCard({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  return (
    <div className={`stat-card rounded-2xl border ${color} p-4 sm:p-5 card-hover animate-fadeInUp`}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/60 flex items-center justify-center text-xl">{emoji}</div>
        <div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800">{value}</div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  )
}

// =============================================
// STATUS BADGE
// =============================================
function StatusBadge({ status, forTeacher }: { status: string; forTeacher?: string }) {
  const display = forTeacher || status
  let cls = 'text-slate-600 bg-slate-100'
  let icon = '📄'
  if (display === 'ยังไม่เปิดอ่าน') { cls = 'text-amber-600 bg-amber-50 border border-amber-200'; icon = '📄' }
  if (display === 'เปิดอ่านแล้ว') { cls = 'text-blue-700 bg-blue-50 border border-blue-200'; icon = '👁️' }
  if (display === 'รับทราบแล้ว') { cls = 'text-emerald-700 bg-emerald-50 border border-emerald-200'; icon = '✅' }
  if (display === 'เสร็จสิ้น') { cls = 'text-emerald-700 bg-emerald-50 border border-emerald-200'; icon = '🎉' }
  if (status.includes('รอ ผอ.')) { cls = 'text-amber-700 bg-amber-50 border border-amber-200'; icon = '⏳' }
  if (status.includes('อนุมัติ')) { cls = 'text-purple-700 bg-purple-50 border border-purple-200'; icon = '✅' }
  if (status.includes('แจกจ่าย')) { cls = 'text-indigo-700 bg-indigo-50 border border-indigo-200'; icon = '📤' }
  return <span className={`status-badge ${cls}`}>{icon} {display}</span>
}

// =============================================
// MAIN DASHBOARD VIEW
// =============================================
export default function DashboardView() {
  const { state, dispatch, showLoading, showToast, loadDashboard, loadTeachers } = useApp()
  const { currentUser, allDocs, allTeachers, currentTab, settings, schoolLogoUrl } = state
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [sendAction, setSendAction] = useState('')
  const [trackingDoc, setTrackingDoc] = useState<Document | null>(null)
  const [teacherEditOpen, setTeacherEditOpen] = useState(false)
  const [teacherEditData, setTeacherEditData] = useState<{ mode: 'add' | 'edit'; data?: Record<string, unknown> } | null>(null)
  const [adminEditDoc, setAdminEditDoc] = useState<Document | null>(null)
  const [distributeDoc, setDistributeDoc] = useState<Document | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadTeachers() }, [loadTeachers])

  // =============================================
  // TABS
  // =============================================
  const tabs = useMemo(() => {
    if (!currentUser) return []
    if (currentUser.role === 'clerk') return [
      { id: 'clerk-pending', label: '⏳ รอ ผอ.' },
      { id: 'clerk-distribute', label: '📤 รออนุมัติแจก' },
      { id: 'clerk-tracking', label: '📊 ติดตาม' },
      { id: 'summary', label: '👥 สรุปครู' },
      { id: 'admin-manage', label: '🛠️ จัดการเอกสาร' },
      { id: 'teacher-manage', label: '👨‍🏫 จัดการบุคลากร' },
    ]
    if (currentUser.role === 'director') return [
      { id: 'director-pending', label: '📝 รออนุมัติ' },
      { id: 'director-tracking', label: '📊 ติดตาม' },
      { id: 'summary', label: '👥 สรุปครู' },
    ]
    if (currentUser.role === 'admin') return [
      { id: 'admin-all', label: '📁 ทั้งหมด' },
      { id: 'summary', label: '👥 สรุปครู' },
      { id: 'admin-manage', label: '🛠️ จัดการ' },
      { id: 'teacher-manage', label: '👨‍🏫 บุคลากร' },
    ]
    return [{ id: 'teacher-inbox', label: '📥 เอกสารของฉัน' }]
  }, [currentUser])

  // Set default tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === currentTab)) {
      dispatch({ type: 'SET_TAB', payload: tabs[0].id })
    }
  }, [tabs, currentTab, dispatch])

  // =============================================
  // OVERDUE DETECTION
  // =============================================
  const overdueMap = useMemo(() => {
    const map: Record<string, number> = {}
    const now = new Date()
    allDocs.forEach(doc => {
      if (!doc.status.includes('รอ ผอ.') && !doc.status.includes('อนุมัติแล้ว')) return
      if (!doc.created_at) return
      const diff = (now.getTime() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60)
      if (diff >= 24) map[doc.id] = Math.floor(diff)
    })
    return map
  }, [allDocs])

  // =============================================
  // STATS
  // =============================================
  const stats = useMemo(() => {
    if (!currentUser) return []
    if (currentUser.role === 'teacher') {
      const myDocs = allDocs.filter(d => {
        if (!d.status.includes('แจกจ่าย')) return false
        const targets = (d.target || '').split(',').map(s => s.trim())
        return targets.includes('all') || targets.includes(currentUser.id!)
      })
      let completed = 0, acknowledged = 0, read = 0, unread = 0
      myDocs.forEach(doc => {
        const st = doc.tracking_data?.[currentUser.id!]
        if (st === 'completed') completed++
        else if (st === 'acknowledged') acknowledged++
        else if (st === 'read') read++
        else unread++
      })
      return [
        { emoji: '✅', label: 'เสร็จสิ้น', value: completed, color: 'border-emerald-200' },
        { emoji: '📋', label: 'รับทราบแล้ว', value: acknowledged, color: 'border-indigo-200' },
        { emoji: '👁️', label: 'เปิดอ่านแล้ว', value: read, color: 'border-blue-200' },
        { emoji: '📖', label: 'ยังไม่อ่าน', value: unread, color: 'border-amber-200' },
      ]
    }
    if (currentUser.role === 'clerk') {
      return [
        { emoji: '⏳', label: 'รอ ผอ.', value: allDocs.filter(d => d.status.includes('รอ ผอ.')).length, color: 'border-orange-200' },
        { emoji: '✅', label: 'รอแจกจ่าย', value: allDocs.filter(d => d.status.includes('อนุมัติ')).length, color: 'border-purple-200' },
        { emoji: '📤', label: 'แจกจ่ายแล้ว', value: allDocs.filter(d => d.status.includes('แจกจ่าย')).length, color: 'border-indigo-200' },
        { emoji: '📁', label: 'ทั้งหมด', value: allDocs.length, color: 'border-slate-200' },
      ]
    }
    return [
      { emoji: '📝', label: 'รอพิจารณา', value: allDocs.filter(d => d.status.includes('รอ ผอ.')).length, color: 'border-orange-200' },
      { emoji: '📤', label: 'แจกจ่ายแล้ว', value: allDocs.filter(d => d.status.includes('แจกจ่าย')).length, color: 'border-indigo-200' },
      { emoji: '📁', label: 'ทั้งหมด', value: allDocs.length, color: 'border-slate-200' },
    ]
  }, [currentUser, allDocs])

  // =============================================
  // VISIBLE DOCS
  // =============================================
  const visibleDocs = useMemo(() => {
    if (!currentUser) return []
    let docs = [...allDocs]

    if (currentUser.role === 'clerk') {
      if (currentTab === 'clerk-pending') docs = docs.filter(d => d.status.includes('รอ ผอ.'))
      else if (currentTab === 'clerk-distribute') docs = docs.filter(d => d.status.includes('อนุมัติแล้ว'))
      else if (currentTab === 'clerk-tracking') docs = docs.filter(d => d.status.includes('แจกจ่าย'))
      // admin-manage = all docs (no filter)
      else if (currentTab !== 'admin-manage') docs = []
    } else if (currentUser.role === 'director') {
      if (currentTab === 'director-pending') docs = docs.filter(d => d.status.includes('รอ ผอ.'))
      else if (currentTab === 'director-tracking') docs = docs.filter(d => d.status.includes('แจกจ่าย'))
      else docs = []
    } else if (currentUser.role === 'teacher') {
      docs = docs.filter(d => {
        if (!d.status.includes('แจกจ่าย')) return false
        const targets = (d.target || '').split(',').map(s => s.trim())
        return targets.includes('all') || targets.includes(currentUser.id!)
      })
    }
    // admin-all / admin-manage = all docs

    if (search) {
      const s = search.toLowerCase()
      docs = docs.filter(d =>
        d.doc_no?.toLowerCase().includes(s) ||
        d.title?.toLowerCase().includes(s) ||
        d.sender?.toLowerCase().includes(s)
      )
    }
    if (filterStatus) docs = docs.filter(d => d.status.includes(filterStatus))
    return docs
  }, [currentUser, allDocs, currentTab, search, filterStatus])

  // =============================================
  // TEACHER SUMMARY
  // =============================================
  const teacherSummary = useMemo((): TeacherSummary[] => {
    const distributed = allDocs.filter(d => d.status.includes('แจกจ่าย'))
    return allTeachers.map(t => {
      let total = 0, completed = 0, acknowledged = 0, read = 0, unread = 0
      distributed.forEach(doc => {
        const targets = (doc.target || '').split(',').map(s => s.trim())
        if (!targets.includes('all') && !targets.includes(t.id)) return
        total++
        const st = doc.tracking_data?.[t.id]
        if (st === 'completed') completed++
        else if (st === 'acknowledged') acknowledged++
        else if (st === 'read') read++
        else unread++
      })
      return { ...t, total, completed, acknowledged, read, unread, percent: total > 0 ? Math.round(completed / total * 100) : 0 }
    })
  }, [allDocs, allTeachers])

  // =============================================
  // ACTIONS
  // =============================================
  async function openDocument(doc: Document) {
    dispatch({ type: 'SET_CURRENT_DOC', payload: doc })
    dispatch({ type: 'SET_VIEW', payload: 'editor' })
  }

  async function quickAcknowledge(docId: string) {
    showLoading(true, 'กำลังบันทึก...')
    await fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId, userId: currentUser!.id, status: 'acknowledged' }) })
    showLoading(false)
    showToast('✅ รับทราบเรียบร้อย')
    loadDashboard()
  }

  async function quickComplete(docId: string) {
    showLoading(true, 'กำลังอัปเดต...')
    await fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId, userId: currentUser!.id, status: 'completed' }) })
    showLoading(false)
    showToast('✅ เสร็จสิ้นแล้ว')
    loadDashboard()
  }

  async function quickRead(docId: string, fileUrl: string) {
    const doc = allDocs.find(d => d.id === docId)
    const currentStatus = doc?.tracking_data?.[currentUser!.id!]
    if (!currentStatus) {
      await fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId, userId: currentUser!.id, status: 'read' }) })
      loadDashboard()
    }
    window.open(fileUrl, '_blank', 'noreferrer')
  }

  async function handleDistributeSuccess(doc: Document, payload: Record<string, unknown>) {
    showLoading(true, 'กำลังแจกจ่ายเอกสาร...')
    const body = {
      ...payload,
      action: 'distribute',
      docId: doc.id,
      docNo: doc.doc_no,
      sender: currentUser?.name,
      fileData: null,
      existingFileUrl: doc.file_url || '',
      existingAttachmentUrl: doc.attachment_url || '',
      trackingData: JSON.stringify(doc.tracking_data || {}),
    }
    try {
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
        showLoading(false)
        if (res.status === 413) showToast('❌ ไฟล์ใหญ่เกินไป กรุณาลดขนาดไฟล์ก่อนส่ง', 'error')
        else showToast(`❌ เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`, 'error')
        return
      }
      showLoading(false)
      if (result.success) {
        showToast('✅ แจกจ่ายเรียบร้อย!')
        setDistributeDoc(null)
        loadDashboard()
      } else {
        showToast('❌ ' + result.message, 'error')
      }
    } catch (e) {
      showLoading(false)
      showToast('❌ เกิดข้อผิดพลาด: ' + String(e), 'error')
    }
  }

  async function quickDelete(docId: string) {
    if (!confirm('ยืนยันลบเอกสารนี้?')) return
    showLoading(true, 'กำลังลบ...')
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
    showLoading(false)
    showToast('✅ ลบเรียบร้อย')
    loadDashboard()
  }

  async function handleNewDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    showLoading(true, 'กำลังจองเลขรับ...')
    const res = await fetch('/api/running-no')
    const { docNo } = await res.json()
    dispatch({ type: 'SET_NEW_DOC_NO', payload: docNo })
    dispatch({ type: 'SET_CURRENT_DOC', payload: null })
    // เก็บ file ใน sessionStorage เพื่อให้ EditorView ดึงไปใช้
    const reader = new FileReader()
    reader.onload = ev => {
      sessionStorage.setItem('pendingFile', ev.target?.result as string)
      sessionStorage.setItem('pendingFileName', file.name)
      sessionStorage.setItem('pendingFileMime', file.type)
      showLoading(false)
      dispatch({ type: 'SET_VIEW', payload: 'editor' })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function logout() {
    dispatch({ type: 'SET_USER', payload: null })
    dispatch({ type: 'SET_VIEW', payload: 'login' })
  }

  const isManageTab = currentTab === 'admin-manage'
  const isSummaryTab = currentTab === 'summary'
  const isTeacherManageTab = currentTab === 'teacher-manage'
  const schoolName = settings['SCHOOL_NAME'] || 'E-Doc System'

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="h-14 sm:h-16 glass border-b border-slate-200/80 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {schoolLogoUrl ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0">
              <Image src={schoolLogoUrl} alt="logo" width={32} height={32} className="object-contain w-full h-full" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <h1 className="text-base sm:text-xl font-bold text-slate-800 truncate">{schoolName}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold truncate max-w-[120px] sm:max-w-none ${currentUser?.badge}`}>
            {currentUser?.name}
          </span>
          <button onClick={logout} className="text-sm font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">ออก</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-3 sm:p-6">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
            {stats.map((s, i) => <StatCard key={i} {...s} />)}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-bold text-slate-800">📋 กล่องเอกสาร</h2>
              {currentUser?.role === 'clerk' && (
                <>
                  <label htmlFor="docUpload" className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold shadow-sm cursor-pointer flex items-center gap-2 text-sm sm:text-base whitespace-nowrap transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="hidden sm:inline">ลงรับเอกสารใหม่</span>
                    <span className="sm:hidden">+ ลงรับ</span>
                  </label>
                  <input ref={fileInputRef} id="docUpload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleNewDoc} />
                </>
              )}
            </div>
            <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเลขรับ, ชื่อเอกสาร..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:border-indigo-400 transition" />
              </div>
              {(currentUser?.role !== 'teacher') && (
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 max-w-[140px]">
                  <option value="">ทุกสถานะ</option>
                  <option value="รอ ผอ.">รอ ผอ.</option>
                  <option value="อนุมัติ">อนุมัติแล้ว</option>
                  <option value="แจกจ่าย">แจกจ่ายแล้ว</option>
                </select>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 sm:gap-1 mb-3 border-b border-slate-200 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table area */}
          {isSummaryTab ? (
            <SummaryTable data={teacherSummary} />
          ) : isTeacherManageTab ? (
            <TeacherManageTable
              teachers={allTeachers}
              onAdd={() => { setTeacherEditData({ mode: 'add' }); setTeacherEditOpen(true) }}
              onEdit={(t) => { setTeacherEditData({ mode: 'edit', data: t }); setTeacherEditOpen(true) }}
              onDelete={async (id, name) => {
                if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return
                await fetch(`/api/teachers/${id}`, { method: 'DELETE' })
                showToast('ลบเรียบร้อย')
                loadTeachers()
              }}
            />
          ) : (
            <DocumentTable
              docs={visibleDocs}
              isManageTab={isManageTab}
              currentTab={currentTab}
              currentUser={currentUser}
              overdueMap={overdueMap}
              onOpen={openDocument}
              onAck={quickAcknowledge}
              onComplete={quickComplete}
              onRead={quickRead}
              onDelete={quickDelete}
              onTracking={setTrackingDoc}
              onEdit={setAdminEditDoc}
              onDistribute={setDistributeDoc}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {sendModalOpen && (
        <SendModal
          action={sendAction}
          teachers={allTeachers}
          onClose={() => setSendModalOpen(false)}
          onSuccess={() => { setSendModalOpen(false); loadDashboard() }}
        />
      )}
      {trackingDoc && (
        <TrackingModal
          doc={trackingDoc}
          teachers={allTeachers}
          onClose={() => setTrackingDoc(null)}
        />
      )}
      {teacherEditOpen && teacherEditData && (
        <TeacherEditModal
          mode={teacherEditData.mode}
          initialData={teacherEditData.data}
          onClose={() => setTeacherEditOpen(false)}
          onSuccess={() => { setTeacherEditOpen(false); loadTeachers() }}
        />
      )}
      {adminEditDoc && (
        <AdminEditModal
          doc={adminEditDoc}
          teachers={allTeachers}
          onClose={() => setAdminEditDoc(null)}
          onSuccess={() => { setAdminEditDoc(null); loadDashboard() }}
        />
      )}
      {distributeDoc && (
        <SendModal
          action="distribute"
          teachers={allTeachers}
          initialTitle={distributeDoc.title}
          initialNote={distributeDoc.note}
          currentDocTarget={distributeDoc.target || ''}
          onClose={() => setDistributeDoc(null)}
          onSuccess={(payload) => handleDistributeSuccess(distributeDoc, payload)}
        />
      )}
    </div>
  )
}

// =============================================
// DOCUMENT TABLE
// =============================================
function DocumentTable({ docs, isManageTab, currentTab, currentUser, overdueMap, onOpen, onAck, onComplete, onRead, onDelete, onTracking, onEdit, onDistribute }: {
  docs: Document[]
  isManageTab: boolean
  currentTab: string
  currentUser: ReturnType<typeof useApp>['state']['currentUser']
  overdueMap: Record<string, number>
  onOpen: (doc: Document) => void
  onAck: (id: string) => void
  onComplete: (id: string) => void
  onRead: (id: string, url: string) => void
  onDelete: (id: string) => void
  onTracking: (doc: Document) => void
  onEdit: (doc: Document) => void
  onDistribute: (doc: Document) => void
}) {
  if (docs.length === 0) return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
      <svg className="w-12 h-12 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      <span className="font-medium">ไม่มีเอกสารในหมวดหมู่นี้</span>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[520px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <th className="p-3 sm:p-4">เลขรับ</th>
              <th className="p-3 sm:p-4">ชื่อเอกสาร</th>
              <th className="p-3 sm:p-4 hidden sm:table-cell">ผู้ส่ง</th>
              <th className="p-3 sm:p-4">สถานะ</th>
              <th className="p-3 sm:p-4 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, idx) => {
              const isOverdue = overdueMap[doc.id]
              const tracking = doc.tracking_data || {}
              const myStatus = currentUser?.role === 'teacher' ? tracking[currentUser.id!] : undefined

              let teacherDisplay: string | undefined
              if (currentUser?.role === 'teacher') {
                if (!myStatus) teacherDisplay = 'ยังไม่เปิดอ่าน'
                else if (myStatus === 'read') teacherDisplay = 'เปิดอ่านแล้ว'
                else if (myStatus === 'acknowledged') teacherDisplay = 'รับทราบแล้ว'
                else teacherDisplay = 'เสร็จสิ้น'
              }

              return (
                <tr key={doc.id} className={`table-row border-b ${isOverdue ? 'border-red-200 bg-red-50/40' : 'border-slate-100'} animate-fadeInUp`} style={{ animationDelay: `${idx * 0.03}s` }}>
                  <td className="p-3 sm:p-4">
                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs sm:text-sm">{doc.doc_no}</span>
                  </td>
                  <td className="p-3 sm:p-4">
                    <div className="font-medium text-slate-800 text-sm sm:text-base flex flex-wrap items-center gap-1">
                      {doc.urgent && <span className="text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse">🔴 ด่วนมาก</span>}
                      {doc.doc_type && <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">{doc.doc_type}</span>}
                      {doc.title}
                      {isOverdue && <span className="text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">🔥 ค้าง {isOverdue} ชม.</span>}
                    </div>
                    {doc.note && <div className="text-xs text-amber-600 mt-0.5">📝 {doc.note}</div>}
                    {doc.attachment_url && doc.attachment_url.split('\n').filter(Boolean).map((url, i, arr) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 mr-2">
                        📎 {arr.length > 1 ? `เอกสารเพิ่มเติม ${i + 1}` : 'เอกสารเพิ่มเติม'}
                      </a>
                    ))}
                  </td>
                  <td className="p-3 sm:p-4 text-slate-500 text-sm hidden sm:table-cell">{doc.sender}</td>
                  <td className="p-3 sm:p-4">
                    <StatusBadge status={doc.status} forTeacher={teacherDisplay} />
                  </td>
                  <td className="p-3 sm:p-4">
                    <div className="flex justify-end items-center gap-1.5 flex-wrap">
                      {isManageTab ? (
                        <>
                          <button onClick={() => onEdit(doc)} className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-xs font-semibold text-indigo-600 transition">✏️ แก้ไข</button>
                          <button onClick={() => onDelete(doc.id)} className="px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-xs font-semibold text-red-600 transition">🗑️ ลบ</button>
                        </>
                      ) : (
                        <>
                          {/* ปุ่มแจกจ่ายนอก canvas สำหรับ clerk-distribute */}
                          {currentUser?.role === 'clerk' && currentTab === 'clerk-distribute' && doc.status.includes('อนุมัติแล้ว') && (
                            <button onClick={() => onDistribute(doc)} className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition shadow-sm">📢 แจกจ่าย</button>
                          )}
                          {doc.status.includes('แจกจ่าย') && currentUser?.role !== 'teacher' && (
                            <button onClick={() => onTracking(doc)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-600 transition">📊 ติดตาม</button>
                          )}
                          {currentUser?.role === 'teacher' && !myStatus && (
                            <button onClick={() => onAck(doc.id)} className="px-2.5 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-xs font-bold transition shadow-sm">📋 รับทราบ</button>
                          )}
                          {currentUser?.role === 'teacher' && myStatus === 'read' && (
                            <button onClick={() => onAck(doc.id)} className="px-2.5 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-xs font-bold transition shadow-sm">📋 รับทราบ</button>
                          )}
                          {currentUser?.role === 'teacher' && myStatus === 'acknowledged' && (
                            <button onClick={() => onComplete(doc.id)} className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-xs font-bold transition shadow-sm">✅ เสร็จสิ้น</button>
                          )}
                          {currentUser?.role === 'teacher' && doc.file_url && (
                            <button onClick={() => onRead(doc.id, doc.file_url)} className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 text-xs font-semibold text-blue-700 transition">📂 เปิดอ่าน</button>
                          )}
                          {currentUser?.role !== 'teacher' && (
                            <button onClick={() => onOpen(doc)} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 text-xs font-semibold text-slate-700 hover:text-indigo-700 transition">📄 เปิด</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
        แสดง {docs.length} รายการ
      </div>
    </div>
  )
}

// =============================================
// SUMMARY TABLE
// =============================================
function SummaryTable({ data }: { data: TeacherSummary[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[480px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 text-xs font-bold text-slate-500 uppercase">ชื่อ-สกุล</th>
              <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase">ได้รับ</th>
              <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">เสร็จ</th>
              <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">ยังไม่อ่าน</th>
              <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase">สำเร็จ</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t, idx) => {
              const barColor = t.percent >= 75 ? 'bg-emerald-500' : t.percent >= 50 ? 'bg-indigo-500' : t.percent >= 25 ? 'bg-amber-400' : 'bg-red-400'
              return (
                <tr key={t.id} className="table-row border-b border-slate-100 animate-fadeInUp" style={{ animationDelay: `${idx * 0.03}s` }}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">{t.name.charAt(0)}</div>
                      <div>
                        <div className="font-medium text-slate-800 text-sm">{t.name}</div>
                        <div className="text-xs text-slate-400">{t.department}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">{t.total}</td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    <span className="font-bold text-emerald-600">{t.completed}</span>
                    <span className="text-xs text-slate-400 ml-1">/ รับทราบ {t.acknowledged}</span>
                  </td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    <span className={`font-bold ${t.unread > 0 ? 'text-red-500' : 'text-slate-400'}`}>{t.unread}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 sm:w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full progress-bar-fill`} style={{ width: `${t.percent}%` }} />
                      </div>
                      <span className={`font-bold text-xs ${t.percent >= 75 ? 'text-emerald-600' : t.percent >= 50 ? 'text-indigo-600' : t.percent >= 25 ? 'text-amber-600' : 'text-red-500'}`}>{t.percent}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================
// TEACHER MANAGE TABLE
// =============================================
function TeacherManageTable({ teachers, onAdd, onEdit, onDelete }: {
  teachers: ReturnType<typeof useApp>['state']['allTeachers']
  onAdd: () => void
  onEdit: (t: Record<string, unknown>) => void
  onDelete: (id: string, name: string) => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-3 bg-emerald-50/50 border-b border-emerald-100">
        <button onClick={onAdd} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          เพิ่มบุคลากรใหม่
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[480px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 text-xs font-bold text-slate-500 uppercase">รหัส</th>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase">ชื่อ-สกุล</th>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">หมวดวิชา</th>
              <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase">LINE</th>
              <th className="p-3 text-right text-xs font-bold text-slate-500 uppercase">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, idx) => (
              <tr key={t.id} className="table-row border-b border-slate-100 animate-fadeInUp" style={{ animationDelay: `${idx * 0.03}s` }}>
                <td className="p-3"><span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs">{t.id}</span></td>
                <td className="p-3 font-medium text-slate-800 text-sm">{t.name}</td>
                <td className="p-3 text-slate-500 text-sm hidden sm:table-cell">{t.department}</td>
                <td className="p-3 text-center">
                  {t.line_user_id ? (
                    <span className="status-badge text-green-700 bg-green-50 border border-green-200">📲 เชื่อมแล้ว</span>
                  ) : (
                    <span className="status-badge text-slate-500 bg-slate-50 border border-slate-200">⬜ ยังไม่ตั้ง</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => onEdit(t as unknown as Record<string, unknown>)} className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-xs font-semibold text-indigo-600 transition">✏️ แก้ไข</button>
                    <button onClick={() => onDelete(t.id, t.name)} className="px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-xs font-semibold text-red-600 transition">🗑️ ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
