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
    // 에이전트 서버(agent/main.py)가 아예 꺼져 있거나(로컬 dev, ECONNREFUSED) 애초에
    // 배포되지 않아 도달 불가능할 때(프로덕션 — NEXT_PUBLIC_AGENT_API_URL 미설정 시
    // localhost:8000으로 폴백해 마찬가지로 연결 실패) — fetch 자체가 던지므로 res.status를
    // 볼 수 없다. 500 원문 대신 사람이 읽을 메시지로 응답하되, "터미널에서 실행하라"는
    // 안내는 로컬 dev에서만 의미가 있으므로 NODE_ENV로 분기한다.
    const message =
      process.env.NODE_ENV === "production"
        ? "AI 도우미는 준비 중이에요."
        : "AI 도우미 서버가 꺼져 있어요. 터미널에서 npm run dev:all로 실행해주세요.";
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 서버 액션에서 직접 에이전트 서버를 호출할 때 쓴다(예: 끼니 저장 후 백그라운드 영양 추정) —
 * 이미 서버 코드라 브라우저를 거치지 않으므로 /api/agent/* 프록시 라우트를 왕복할 필요가 없고,
 * 호출부가 이미 로그인 여부를 확인한 뒤라 requireAuthOrRespond()도 필요 없다. */
export async function callAgentServer<T>(path: string, body: unknown): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.AGENT_API_KEY) headers["X-API-Key"] = process.env.AGENT_API_KEY;

  const res = await fetch(`${AGENT_API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : `agent_http_${res.status}`);
  }
  return data as T;
}
