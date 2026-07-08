export interface AgentMemberOption {
  user_id: string;
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

export type AgentResponse =
  | { status: "ok"; thread_id: string; schedules: AgentSchedule[] }
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
