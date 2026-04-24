'use client'
import { useEffect } from 'react'
import { useApp } from '@/lib/store'

export default function ToastContainer() {
  const { state, dispatch } = useApp()

  useEffect(() => {
    if (state.toasts.length === 0) return
    const latest = state.toasts[state.toasts.length - 1]
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: latest.id })
    }, 3500)
    return () => clearTimeout(timer)
  }, [state.toasts, dispatch])

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {state.toasts.map(t => (
        <div
          key={t.id}
          className={`${t.type === 'success' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'} text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl shadow-lg font-semibold pointer-events-auto flex items-center gap-2 text-xs sm:text-sm max-w-full animate-fadeInUp`}
        >
          <span>{t.message}</span>
          <button onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: t.id })} className="ml-auto opacity-70 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  )
}
