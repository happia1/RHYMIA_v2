import { IconCalendar } from "@tabler/icons-react";
import { requireWorkspaceContext } from "@/lib/workspace";
import { toDateStr, getWeekDates } from "@/lib/date";
import { getCurrentWeather } from "@/lib/weather";
import { mapWorkspaceMembers } from "@/lib/members";
import { ScheduleTabs } from "@/components/schedule/ScheduleTabs";
import { EventFilters } from "@/components/schedule/EventFilters";
import { ScheduleDayView } from "@/components/schedule/ScheduleDayView";
import { MonthView } from "@/components/schedule/MonthView";
import { WeekView } from "@/components/schedule/WeekView";
import { YearView } from "@/components/schedule/YearView";
import { AddEventEntry } from "@/components/schedule/AddEventEntry";
import { AgentLauncher } from "@/components/agent/AgentLauncher";
import { SectionLabel } from "@/components/home/SectionLabel";
import { getSchedulesForRange } from "@/app/(main)/schedule/actions";
import type { Schedule, Routine } from "@/types";

const VIEW_LABEL: Record<"day" | "month" | "week" | "year", string> = {
  day: "하루 일과",
  month: "월간 일정",
  week: "주간 일정",
  year: "연간 일정",
};

type ViewMode = "day" | "month" | "week" | "year";

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
    member?: string;
    highlight?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const view: ViewMode =
    params.view === "day" || params.view === "week" || params.view === "year"
      ? (params.view as ViewMode)
      : "month";
  const anchor = new Date(params.date ?? toDateStr(new Date()));
  const anchorStr = toDateStr(anchor);

  // 월간/연간 뷰는 반복 일정(기념일·생신 등) 가상 인스턴스까지 합쳐서 조회한다
  // (getSchedulesForRange, schedule/actions.ts). 주간 뷰는 범위가 좁아 이번 범위에서는
  // 제외 — 기존과 동일하게 저장된 행만 그대로 조회. "하루" 뷰는 이 조회 자체가 필요 없음.
  // range/scheduleRows는 memberRows/weather 어느 쪽에도 의존하지 않아(workspaceId·user.id·
  // anchor만 있으면 계산 가능) 같은 Promise.all에 넣어 왕복을 하나 줄인다 — 이전엔
  // memberRows/weather를 기다린 뒤에야 순차로 요청했음(불필요한 순차 의존이었음).
  const range =
    view === "month"
      ? monthRange(anchor)
      : view === "year"
      ? yearRange(anchor)
      : { start: getWeekDates(anchor)[0], end: getWeekDates(anchor)[6] };

  const [{ data: memberRows }, weather, scheduleRows] = await Promise.all([
    supabase
      .from("workspace_member")
      .select(
        "id, user_id, member_type, display_name, name, avatar_color, avatar_image_url, birth_year, routine_enabled, users(avatar_color, avatar_text_color, avatar_image_url)"
      )
      .eq("workspace_id", workspaceId),
    getCurrentWeather(),
    view === "day"
      ? Promise.resolve<Schedule[]>([])
      : view === "week"
      ? (async () => {
          const { data, error } = await supabase
            .from("schedule")
            .select("*")
            .eq("workspace_id", workspaceId)
            .gte("date_start", range.start)
            .lte("date_start", range.end)
            .or(`is_shared.eq.true,author_id.eq.${user.id}`)
            .order("date_start", { ascending: true });
          if (error) throw new Error(error.message);
          return (data ?? []) as Schedule[];
        })()
      : getSchedulesForRange(workspaceId, user.id, range.start, range.end),
  ]);

  const members = mapWorkspaceMembers(memberRows ?? []);
  const myMember = members.find((m) => m.user_id === user.id);
  const membersById = Object.fromEntries(members.map((m) => [m.id, m]));

  // "하루" 뷰는 반복 일정(schedule)이 아니라 루틴(routine) 도넛+블록 편집 화면이라 데이터
  // 소스가 완전히 달라서(월간/주간/연간과 다르게 scope/target 필터도 없음) 별도로 분기한다.
  // 예전 /schedule/routine 페이지(RoutineEditor)가 하던 조회를 그대로 옮겨온 것.
  if (view === "day") {
    const editableMembers = members.filter(
      (m) => m.user_id === user.id || m.member_type === "managed"
    );
    const memberIds = editableMembers.map((m) => m.id);

    const { data: routines } = await supabase
      .from("routine")
      .select("*")
      .in("member_id", memberIds.length ? memberIds : [""]);

    // 홈 가족상태 탭 등에서 ?member= 로 특정 멤버를 지정해 들어올 수 있음(딥링크) —
    // 그 멤버가 이 워크스페이스에서 실제로 편집 가능한 대상일 때만 반영.
    const requestedMemberId =
      params.member && editableMembers.some((m) => m.id === params.member)
        ? params.member
        : myMember?.id ?? editableMembers[0]?.id ?? "";

    return (
      <div className="flex h-[calc(100dvh-64px)] flex-col gap-section overflow-hidden px-4 pt-6">
        <div className="shrink-0">
          <ScheduleTabs anchorDate={anchorStr} view={view} />
        </div>

        <div className="h-px w-full shrink-0 bg-border-light" />

        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          <section className="flex flex-col gap-label-gap">
            <SectionLabel icon={<IconCalendar size={14} />}>{VIEW_LABEL[view]}</SectionLabel>
            <div className="pl-section-indent">
              <ScheduleDayView
                members={editableMembers}
                initialRoutines={(routines as Routine[]) ?? []}
                defaultMemberId={requestedMemberId}
              />
            </div>
          </section>
        </div>

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

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col gap-section overflow-hidden px-4 pt-6">
      <div className="flex shrink-0 flex-col gap-3">
        <ScheduleTabs anchorDate={anchorStr} view={view} />
        <EventFilters
          members={members}
          scope={params.scope ?? "all"}
          target={params.target ?? "all"}
        />
      </div>

      <div className="h-px w-full shrink-0 bg-border-light" />

      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
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
                highlightId={params.highlight}
              />
            )}
            {view === "week" && (
              <WeekView
                weekDates={getWeekDates(anchor)}
                schedules={schedules}
                membersById={membersById}
                workspaceId={workspaceId}
              />
            )}
            {view === "year" && (
              <YearView
                anchorDate={anchorStr}
                schedules={schedules}
                membersById={membersById}
                keywordMain={params.keywordMain}
                workspaceId={workspaceId}
              />
            )}
          </div>
        </section>
      </div>

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
