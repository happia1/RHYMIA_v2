import { createClient } from "@/lib/supabase/server";

const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:8000";

/** /api/agent/* route handler 공용 로그인 검증 — 미로그인이면 401 Response를 반환하고,
 * 호출부(각 route.ts)는 이걸 그대로 리턴해 에이전트 서버로 넘기지 않는다.
 * 로그인 상태면 null을 반환해 호출부가 계속 진행하도록 한다. */
export async function requireAuthOrRespond(): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

/** 브라우저 → Next 서버(route handler) → 에이전트 서버로 프록시. AGENT_API_KEY는 서버 전용 환경변수라 클라이언트에 노출되지 않는다. */
export async function proxyAgentRequest(path: string, body: string): Promise<Response> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.AGENT_API_KEY) headers["X-API-Key"] = process.env.AGENT_API_KEY;

  const res = await fetch(`${AGENT_API_URL}${path}`, {
    method: "POST",
    headers,
    body,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
