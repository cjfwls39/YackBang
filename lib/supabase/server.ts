import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * 서버 전용 Supabase 클라이언트 (지연 초기화)
 * 빌드 시점이 아닌 실제 요청 시점에만 초기화됩니다.
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.\n" +
      ".env.local 파일을 확인해주세요."
    );
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
