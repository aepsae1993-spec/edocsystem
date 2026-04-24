import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ใช้ SupabaseClient แบบไม่ระบุ Database generic
// เพื่อหลีกเลี่ยงปัญหา type inference เป็น 'never' ในทุก update/insert
// (เราทำ type safety เอง ผ่าน types/database.ts ในแต่ละ route)

// Client-side (browser)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

// Server-side (API routes) — ใช้ service_role เพื่อข้าม RLS
export function createServiceClient(): SupabaseClient {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

