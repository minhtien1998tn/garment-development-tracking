import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — tạo file .env từ .env.example."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Domain dùng cho email tổng hợp mã NV -> email, phải khớp với migrations/seed. */
export const EMPLOYEE_EMAIL_DOMAIN = "pdc.local";
