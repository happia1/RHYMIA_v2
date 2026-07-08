import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { toDateStr } from "@/lib/date";
import { getKeywordColor } from "@/lib/scheduleKeywords";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();
  const todayStr = toDateStr(new Date());

  const { data: workspace } = await supabase
    .from("family_workspace")
    .select("id, name")
    .eq("share_token", token)
    .maybeSingle();

  if (!workspace) notFound();

  const workspaceId = workspace.id;

  const [{ data: schedules }, { data: meals }, { data: notices }] = await Promise.all([
    supabase
      .from("schedule")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("date_start", todayStr)
      .eq("is_shared", true),
    supabase.from("meal").select("*").eq("workspace_id", workspaceId).eq("date", todayStr),
    supabase
      .from("notice")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_pinned", true),
  ]);

  return (
    <div className="min-h-screen bg-cream px-4 pb-10 pt-8">
      <div className="mb-6 flex flex-col gap-1">
        <span className="text-[12px] text-stone">읽기 전용 · {todayStr}</span>
        <h1 className="text-[20px] font-medium text-ink">{workspace.name}</h1>
      </div>

      <section className="mb-5 flex flex-col gap-2">
        <span className="text-[12px] font-medium text-stone">오늘 식탁</span>
        <div className="flex flex-col gap-2 rounded-2xl border border-border-light bg-surface p-4">
          {(meals ?? []).length === 0 && (
            <p className="text-[13px] text-stone">등록된 끼니가 없어요</p>
          )}
          {(meals ?? []).map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-[18px]">{m.emoji}</span>
              <span className="text-[11px] text-stone">{m.tag}</span>
              <span className="text-[14px] text-ink">{m.main_menu}</span>
              {m.type === "외식" && m.place && (
                <span className="text-[12px] text-stone">
                  · {m.place}
                  {m.reservation_time ? ` ${m.reservation_time}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5 flex flex-col gap-2">
        <span className="text-[12px] font-medium text-stone">오늘 일정</span>
        <div className="flex flex-col gap-2 rounded-2xl border border-border-light bg-surface p-4">
          {(schedules ?? []).length === 0 && (
            <p className="text-[13px] text-stone">등록된 일정이 없어요</p>
          )}
          {(schedules ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
              />
              <span className="text-[14px] text-ink">{s.title}</span>
              {s.time_start && (
                <span className="text-[12px] text-stone">{s.time_start.slice(0, 5)}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[12px] font-medium text-stone">공지</span>
        <div className="flex flex-col gap-2 rounded-2xl border border-border-light bg-surface p-4">
          {(notices ?? []).length === 0 && (
            <p className="text-[13px] text-stone">고정된 공지가 없어요</p>
          )}
          {(notices ?? []).map((n) => (
            <div key={n.id}>
              {n.title && <p className="text-[13px] font-medium text-ink">{n.title}</p>}
              <p className="text-[13px] text-ink">{n.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
