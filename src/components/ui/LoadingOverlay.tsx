'use client'
import { useApp } from '@/lib/store'

export default function LoadingOverlay() {
  const { state } = useApp()
  if (!state.loading) return null

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex flex-col justify-center items-center text-white">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-400 mb-4" />
        <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-indigo-300 opacity-30" />
      </div>
      <h2 className="text-2xl font-bold mt-4">กำลังประมวลผล...</h2>
      <p className="text-slate-300 mt-2 text-base">{state.loadingText || 'โปรดรอสักครู่'}</p>
    </div>
  )
}
