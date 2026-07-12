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

  let res: Response;
  try {
    res = await fetch(`${AGENT_API_URL}${path}`, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    // 에이전트 서버(agent/main.py)가 아예 꺼져 있을 때(ECONNREFUSED 등) — fetch 자체가 던지므로
    // res.status를 볼 수 없다. 500 원문 대신 사용자가 바로 원인을 알 수 있는 메시지로 응답한다.
    return new Response(
      JSON.stringify({
        ok: false,
        message: "AI 도우미 서버가 꺼져 있어요. 터미널에서 npm run dev:all로 실행해주세요.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
