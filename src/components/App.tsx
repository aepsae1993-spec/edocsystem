'use client'
import { useEffect } from 'react'
import { useApp } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import LoginView from './views/LoginView'
import DashboardView from './views/DashboardView'
import EditorView from './views/EditorView'
import LoadingOverlay from './ui/LoadingOverlay'
import ToastContainer from './ui/ToastContainer'

export default function App() {
  const { state, dispatch, showToast } = useApp()

  // โหลดโลโก้โรงเรียนจาก Supabase Storage ครั้งเดียว
  useEffect(() => {
    async function loadLogo() {
      try {
        const { data } = supabase.storage.from('school-assets').getPublicUrl('logo.png')
        if (data?.publicUrl) dispatch({ type: 'SET_SCHOOL_LOGO', payload: data.publicUrl })
      } catch { /* ไม่มีโลโก้ก็ไม่เป็นไร */ }
    }
    loadLogo()
  }, [dispatch])

  // โหลด settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        dispatch({ type: 'SET_SETTINGS', payload: data })
      } catch { 
        showToast('โหลด settings ล้มเหลว', 'error')
      }
    }
    loadSettings()
  }, [dispatch, showToast])

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <LoadingOverlay />
      <ToastContainer />
      {state.view === 'login' && <LoginView />}
      {state.view === 'dashboard' && <DashboardView />}
      {state.view === 'editor' && <EditorView />}
    </div>
  )
}
