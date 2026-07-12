import { IconCalendar } from "@tabler/icons-react";
import { requireWorkspaceContext } from "@/lib/workspace";
import { toDateStr, getWeekDates } from "@/lib/date";
import { getCurrentBlock } from "@/lib/routineUtils";
import { getCurrentWeather } from "@/lib/weather";
import { mapWorkspaceMembers } from "@/lib/members";
import { RoutineTopWidget } from "@/components/schedule/RoutineTopWidget";
import { ScheduleTabs } from "@/components/schedule/ScheduleTabs";
import { EventFilters } from "@/components/schedule/EventFilters";
import { MonthView } from "@/components/schedule/MonthView";
import { WeekView } from "@/components/schedule/WeekView";
import { YearView } from "@/components/schedule/YearView";
import { AddEventEntry } from "@/components/schedule/AddEventEntry";
import { AgentLauncher } from "@/components/agent/AgentLauncher";
import { SectionLabel } from "@/components/home/SectionLabel";
import { getSchedulesForRange } from "@/app/(main)/schedule/actions";
import type { Schedule, RoutineBlock } from "@/types";

const VIEW_LABEL: Record<"month" | "week" | "year", string> = {
  month: "월간 일정",
  week: "주간 일정",
  year: "연간 일정",
};

type ViewMode = "month" | "week" | "year";

function monthRange(anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: toDateStr(start), end: toDateStr(end) };
}

function yearRange(anchor: Date) {
  const start = new Date(anchor.getFullYear(), 0, 1);
  const end = new Date(anchor.getFullYear(), 11, 31);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    scope?: string;
    target?: string;
    keywordMain?: string;
    keywordSub?: string;
    new?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const view: ViewMode =
    params.view === "week" || params.view === "year" ? (params.view as ViewMode) : "month";
  const anchor = new Date(params.date ?? toDateStr(new Date()));
  const anchorStr = toDateStr(anchor);

  const range =
    view === "month"
      ? monthRange(anchor)
      : view === "year"
      ? yearRange(anchor)
      : { start: getWeekDates(anchor)[0], end: getWeekDates(anchor)[6] };

  const today = new Date();

  // 월간/연간 뷰는 반복 일정(기념일·생신 등) 가상 인스턴스까지 합쳐서 조회한다
  // (getSchedulesForRange, schedule/actions.ts). 주간 뷰는 범위가 좁아 이번 범위에서는
  // 제외 — 기존과 동일하게 저장된 행만 그대로 조회.
  const scheduleQuery =
    view === "week"
      ? supabase
          .from("schedule")
          .select("*")
          .eq("workspace_id", workspaceId)
          .gte("date_start", range.start)
          .lte("date_start", range.end)
          .or(`is_shared.eq.true,author_id.eq.${user.id}`)
          .order("date_start", { ascending: true })
          .then(({ data, error }) => {
            if (error) throw new Error(error.message);
            return (data ?? []) as Schedule[];
          })
      : getSchedulesForRange(workspaceId, user.id, range.start, range.end);

  const [{ data: memberRows }, scheduleRows, weather] = await Promise.all([
    supabase
      .from("workspace_member")
      .select(
        "id, user_id, member_type, display_name, name, avatar_color, avatar_image_url, birth_year, routine_enabled, users(avatar_color, avatar_text_color, avatar_image_url)"
      )
      .eq("workspace_id", workspaceId),
    scheduleQuery,
    getCurrentWeather(),
  ]);

  const members = mapWorkspaceMembers(memberRows ?? []);
  const myMember = members.find((m) => m.user_id === user.id);

  // 내 루틴 위젯 — 오늘 요일의 전체 블록(도넛 차트용)과 지금 이 순간의 블록(상태 텍스트용)을 함께 쓴다.
  const { data: myRoutineRows } = await supabase
    .from("routine")
    .select("blocks")
    .eq("member_id", myMember?.id ?? "")
    .eq("day_of_week", today.getDay());

  let schedules = scheduleRows;

  if (params.scope === "shared") {
    schedules = schedules.filter((s) => s.is_shared);
  } else if (params.scope === "private") {
    schedules = schedules.filter((s) => !s.is_shared && s.author_id === user.id);
  }

  if (params.target && params.target !== "all") {
    schedules = schedules.filter(
      (s) => s.target_members.length === 0 || s.target_members.includes(params.target!)
    );
  }

  if (params.keywordMain) {
    schedules = schedules.filter((s) => s.keyword_main === params.keywordMain);
    if (params.keywordSub) {
      schedules = schedules.filter((s) => s.keyword_sub === params.keywordSub);
    }
  }

  const myBlocks = (myRoutineRows ?? []).flatMap((r) => (r.blocks as RoutineBlock[]) ?? []);
  const myCurrentBlock = getCurrentBlock(myBlocks, today);

  const membersById = Object.fromEntries(members.map((m) => [m.id, m]));

  return (
    <div className="flex flex-col gap-section px-4 pb-24 pt-6">
      <RoutineTopWidget
        blocks={myBlocks}
        currentBlock={myCurrentBlock}
        routineEnabled={myMember?.routine_enabled ?? true}
      />

      <div className="flex flex-col gap-3">
        <ScheduleTabs anchorDate={anchorStr} view={view} />
        <EventFilters
          members={members}
          scope={params.scope ?? "all"}
          target={params.target ?? "all"}
        />
      </div>

      <div className="h-px w-full bg-border-light" />

      <section className="flex flex-col gap-label-gap">
        <SectionLabel icon={<IconCalendar size={14} />}>{VIEW_LABEL[view]}</SectionLabel>
        <div className="pl-section-indent">
          {view === "month" && (
            <MonthView
              anchorDate={anchorStr}
              schedules={schedules}
              membersById={membersById}
              workspaceId={workspaceId}
              keywordMain={params.keywordMain}
              keywordSub={params.keywordSub}
            />
          )}
          {view === "week" && (
            <WeekView
              weekDates={getWeekDates(anchor)}
              schedules={schedules}
              membersById={membersById}
            />
          )}
          {view === "year" && (
            <YearView anchorDate={anchorStr} schedules={schedules} membersById={membersById} />
          )}
        </div>
      </section>

      <AddEventEntry
        workspaceId={workspaceId}
        members={members}
        defaultDate={anchorStr}
        autoOpen={params.new === "1"}
        weather={weather}
      />
      <AgentLauncher workspaceId={workspaceId} members={members} currentMemberId={myMember?.id ?? ""} />
    </div>
  );
}
