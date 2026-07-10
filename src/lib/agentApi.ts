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

const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:8000";

export async function callAgent(body: {
  user_text?: string;
  image_base64?: string;
  thread_id?: string;
  user_reply?: string;
}): Promise<AgentResponse> {
  const res = await fetch(`${AGENT_API_URL}/process-schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`agent_http_${res.status}`);
  return res.json();
}

/** 메모/공지 작성 시 첨부한 이미지에서 텍스트만 추출 (저장 없이 내용란 자동 채우기용). */
export async function extractTextFromImage(imageBase64: string): Promise<string> {
  const res = await fetch(`${AGENT_API_URL}/extract-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!res.ok) throw new Error(`agent_http_${res.status}`);
  const data = await res.json();
  return data.text ?? "";
}
