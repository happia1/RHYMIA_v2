const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:8000";

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
