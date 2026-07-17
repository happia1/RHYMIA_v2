export interface AgentMemberOption {
  id: string;
  display_name: string;
}

export interface AgentSchedule {
  title: string;
  date_start: string | null;
  date_end: string | null;
  time_start: string | null;
  time_end: string | null;
  supplies: string | null;
  memo: string | null;
  keyword_main: string | null;
  keyword_sub: string | null;
  is_important: boolean;
  target_hint: string | null;
}

export interface AgentRoutineBlock {
  start: string | null;
  end: string | null;
  status: string;
  label: string;
  memo: string | null;
}

export interface AgentRoutine {
  /** 0=일 ~ 6=토 (JS Date.getDay()와 동일) */
  days: number[];
  blocks: AgentRoutineBlock[];
}

export type AgentResponse =
  | {
      status: "ok";
      thread_id: string;
      schedules: AgentSchedule[];
      routines: AgentRoutine[];
      target_hint: string | null;
    }
  | { status: "need_input"; message: string; thread_id: string };

// 에이전트 서버(agent/)로 직접 나가지 않고 Next.js route handler(/api/agent/*)를 경유한다 —
// AGENT_API_KEY는 서버 전용 환경변수라 브라우저에 노출하지 않기 위함 (src/lib/agentServer.ts 참고).

/** Next 서버가 컴파일 에러(dev) 등으로 API 라우트 대신 HTML 에러 페이지를 돌려줄 때가 있다 —
 * 그 상태로 res.json()을 호출하면 "Unexpected token '<'" 같은 원문 파싱 에러가 그대로
 * 사용자에게 노출되므로, 파싱 실패를 사람이 읽을 수 있는 메시지로 바꿔서 던진다. "개발 서버
 * 로그를 확인하라"는 안내는 로컬 dev에서만 의미가 있으므로 프로덕션에서는 일반 안내로 대체. */
async function parseAgentResponse(res: Response): Promise<any> {
  const raw = await res.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      process.env.NODE_ENV === "production"
        ? "AI 도우미는 준비 중이에요."
        : `서버가 예상치 못한 응답을 반환했어요 (status ${res.status}). 개발 서버 로그를 확인해주세요.`
    );
  }
  if (!res.ok) {
    const message = (data as { message?: unknown })?.message;
    throw new Error(typeof message === "string" ? message : `agent_http_${res.status}`);
  }
  return data;
}

export async function callAgent(body: {
  user_text?: string;
  image_base64?: string;
  thread_id?: string;
  user_reply?: string;
}): Promise<AgentResponse> {
  const res = await fetch("/api/agent/process-schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseAgentResponse(res);
}

/** 메모/공지 작성 시 첨부한 이미지에서 텍스트만 추출 (저장 없이 내용란 자동 채우기용). */
export async function extractTextFromImage(imageBase64: string): Promise<string> {
  const res = await fetch("/api/agent/extract-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  const data = await parseAgentResponse(res);
  return data.text ?? "";
}
