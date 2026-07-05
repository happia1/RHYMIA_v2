import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** 인증 없이 읽기 전용 공개 뷰(외부 공유 링크)에서만 사용하는 서버 전용 클라이언트입니다. */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
