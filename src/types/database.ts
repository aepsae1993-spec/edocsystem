// =============================================
// Database types (ตรงกับ Supabase schema)
// =============================================

export interface Teacher {
  id: string
  name: string
  department: string
  line_user_id: string
  drive_folder_id: string
  created_at?: string
  updated_at?: string
}

export interface Document {
  id: string
  doc_no: string
  title: string
  sender: string
  status: string
  file_url: string
  attachment_url: string
  note: string
  target: string           // "all" or "t1,t2,t3"
  tracking_data: Record<string, string>  // {t1: "read", t2: "completed"}
  urgent: string
  created_at?: string
  updated_at?: string
}

export interface LineGroup {
  id: string
  group_id: string
  group_name: string
  status: string
  added_at?: string
  note: string
}

export interface Setting {
  key: string
  value: string
  description: string
  updated_at?: string
}

// =============================================
// App types
// =============================================

export type UserRole = 'admin' | 'clerk' | 'director' | 'teacher'

export interface CurrentUser {
  role: UserRole
  id?: string        // สำหรับ teacher
  name: string
  badge: string
}

export type TrackingStatus = 'read' | 'acknowledged' | 'completed'

export interface TeacherSummary extends Teacher {
  total: number
  completed: number
  acknowledged: number
  read: number
  unread: number
  percent: number
}

// Supabase Database type (minimal)
export interface Database {
  public: {
    Tables: {
      teachers: { Row: Teacher; Insert: Omit<Teacher, 'created_at' | 'updated_at'>; Update: Partial<Teacher> }
      documents: { Row: Document; Insert: Omit<Document, 'created_at' | 'updated_at'>; Update: Partial<Document> }
      line_groups: { Row: LineGroup; Insert: Omit<LineGroup, 'id' | 'added_at'>; Update: Partial<LineGroup> }
      settings: { Row: Setting; Insert: Setting; Update: Partial<Setting> }
    }
  }
}
