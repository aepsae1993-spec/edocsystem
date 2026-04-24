'use client'
import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type { CurrentUser, Document, Teacher } from '@/types/database'

// =============================================
// State
// =============================================
interface AppState {
  currentUser: CurrentUser | null
  view: 'login' | 'dashboard' | 'editor'
  allDocs: Document[]
  allTeachers: Teacher[]
  currentDoc: Document | null
  newGeneratedDocNo: string
  currentTab: string
  settings: Record<string, string>
  schoolLogoUrl: string
  loading: boolean
  loadingText: string
  toasts: { id: string; message: string; type: 'success' | 'error' }[]
}

const initial: AppState = {
  currentUser: null,
  view: 'login',
  allDocs: [],
  allTeachers: [],
  currentDoc: null,
  newGeneratedDocNo: '',
  currentTab: '',
  settings: {},
  schoolLogoUrl: '',
  loading: false,
  loadingText: '',
  toasts: [],
}

// =============================================
// Actions
// =============================================
type Action =
  | { type: 'SET_USER'; payload: CurrentUser | null }
  | { type: 'SET_VIEW'; payload: AppState['view'] }
  | { type: 'SET_DOCS'; payload: Document[] }
  | { type: 'SET_TEACHERS'; payload: Teacher[] }
  | { type: 'SET_CURRENT_DOC'; payload: Document | null }
  | { type: 'SET_NEW_DOC_NO'; payload: string }
  | { type: 'SET_TAB'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Record<string, string> }
  | { type: 'SET_SCHOOL_LOGO'; payload: string }
  | { type: 'SET_LOADING'; payload: { loading: boolean; text?: string } }
  | { type: 'ADD_TOAST'; payload: { message: string; type: 'success' | 'error' } }
  | { type: 'REMOVE_TOAST'; payload: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER': return { ...state, currentUser: action.payload }
    case 'SET_VIEW': return { ...state, view: action.payload }
    case 'SET_DOCS': return { ...state, allDocs: action.payload }
    case 'SET_TEACHERS': return { ...state, allTeachers: action.payload }
    case 'SET_CURRENT_DOC': return { ...state, currentDoc: action.payload }
    case 'SET_NEW_DOC_NO': return { ...state, newGeneratedDocNo: action.payload }
    case 'SET_TAB': return { ...state, currentTab: action.payload }
    case 'SET_SETTINGS': return { ...state, settings: action.payload }
    case 'SET_SCHOOL_LOGO': return { ...state, schoolLogoUrl: action.payload }
    case 'SET_LOADING': return { ...state, loading: action.payload.loading, loadingText: action.payload.text || '' }
    case 'ADD_TOAST': {
      const id = Math.random().toString(36).slice(2)
      return { ...state, toasts: [...state.toasts, { id, ...action.payload }] }
    }
    case 'REMOVE_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) }
    default: return state
  }
}

// =============================================
// Context
// =============================================
interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  showLoading: (loading: boolean, text?: string) => void
  showToast: (message: string, type?: 'success' | 'error') => void
  loadDashboard: () => Promise<void>
  loadTeachers: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const showLoading = useCallback((loading: boolean, text?: string) => {
    dispatch({ type: 'SET_LOADING', payload: { loading, text } })
  }, [])

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    dispatch({ type: 'ADD_TOAST', payload: { message, type } })
    const id = setTimeout(() => {}, 3500) // just for reference
    void id
  }, [])

  const loadDashboard = useCallback(async () => {
    showLoading(true, 'กำลังดึงข้อมูลเอกสาร...')
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      dispatch({ type: 'SET_DOCS', payload: data })
    } catch {
      showToast('ดึงข้อมูลล้มเหลว', 'error')
    } finally {
      showLoading(false)
    }
  }, [showLoading, showToast])

  const loadTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers')
      const data = await res.json()
      dispatch({ type: 'SET_TEACHERS', payload: data })
    } catch {
      showToast('โหลดรายชื่อครูล้มเหลว', 'error')
    }
  }, [showToast])

  return (
    <AppContext.Provider value={{ state, dispatch, showLoading, showToast, loadDashboard, loadTeachers }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
