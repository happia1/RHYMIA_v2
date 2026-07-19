import { requireWorkspaceContext } from "@/lib/workspace";
import { toDateStr, getWeekDates } from "@/lib/date";
import { getWorkspaceMembers } from "@/lib/members.server";
import { ScheduleTabs } from "@/components/schedule/ScheduleTabs";
import { ScheduleDayView } from "@/components/schedule/ScheduleDayView";
import { MonthView } from "@/components/schedule/MonthView";
import { WeekView } from "@/components/schedule/WeekView";
import { YearView } from "@/components/schedule/YearView";
import { AddEventEntry } from "@/components/schedule/AddEventEntry";
import { AgentLauncher } from "@/components/agent/AgentLauncher";
import { TabPageFrame } from "@/components/ui/TabPageFrame";
import { ScrollRegion } from "@/components/ui/ScrollRegion";
import { getSchedulesForRange, getTodosForRange, getOverdueTodos } from "@/app/(main)/schedule/actions";
import type { Schedule, Routine, Todo } from "@/types";

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
  const todayStr = toDateStr(new Date());

  // 월간/주간/연간 뷰 전부 반복 일정(기념일·생신 등) 가상 인스턴스까지 합쳐서 조회한다
  // (getSchedulesForRange, schedule/actions.ts) — 주간 뷰만 date_start 단순 범위 쿼리를
  // 따로 썼던 예전 방식은 이번 주 시작 전부터 걸쳐있는 기간일정을 놓치는 버그가 있어 통일함.
  // "하루" 뷰는 이 조회 자체가 필요 없음. range/scheduleRows는 memberRows 어느 쪽에도
  // 의존하지 않아(workspaceId·user.id·anchor만 있으면 계산 가능) 같은 Promise.all에 넣어
  // 왕복을 하나 줄인다 — 이전엔 memberRows를 기다린 뒤에야 순차로 요청했음(불필요한 순차 의존).
  const range =
    view === "month"
      ? monthRange(anchor)
      : view === "year"
      ? yearRange(anchor)
      : { start: getWeekDates(anchor)[0], end: getWeekDates(anchor)[6] };

  // 할 일(todo)은 선택일 패널이 있는 월간·주간 뷰에서만 필요 — 다른 뷰는 빈 배열로 스킵.
  // 주간 뷰도 예전엔 단순 date_start 범위 쿼리를 따로 써서 이번 주 시작 전부터 걸쳐있는
  // 기간일정·반복일정 가상 인스턴스가 누락되는 버그가 있었음 — 월간/연간과 동일하게
  // getSchedulesForRange로 통일해 겹침 범위를 정확히 계산하도록 고침.
  const [members, scheduleRows, monthTodos, overdueTodos] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    view === "day" ? Promise.resolve<Schedule[]>([]) : getSchedulesForRange(workspaceId, range.start, range.end),
    view === "month" || view === "week"
      ? getTodosForRange(workspaceId, range.start, range.end)
      : Promise.resolve<Todo[]>([]),
    view === "month" || view === "week" ? getOverdueTodos(workspaceId, todayStr) : Promise.resolve<Todo[]>([]),
  ]);

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
      <TabPageFrame className="gap-3 px-4 pt-6">
        <div className="shrink-0">
          <ScheduleTabs anchorDate={anchorStr} view={view} />
        </div>

        <ScrollRegion className="pb-24">
          <ScheduleDayView
            members={editableMembers}
            initialRoutines={(routines as Routine[]) ?? []}
            defaultMemberId={requestedMemberId}
          />
        </ScrollRegion>

        <AddEventEntry
          workspaceId={workspaceId}
          members={members}
          defaultDate={anchorStr}
          autoOpen={params.new === "1"}
        />
        <AgentLauncher workspaceId={workspaceId} members={members} currentMemberId={myMember?.id ?? ""} />
      </TabPageFrame>
    );
  }

  let schedules = scheduleRows;

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
    <TabPageFrame className="gap-2 px-4 pt-6">
      <div className="shrink-0">
        <ScheduleTabs anchorDate={anchorStr} view={view} />
      </div>

      <ScrollRegion
        lockOverflow={view === "month"}
        className={view === "month" ? "" : "pb-24"}
      >
        <section className={`flex flex-col ${view === "month" ? "h-full gap-label-gap" : "gap-label-gap"}`}>
          {view === "month" && (
            <MonthView
              anchorDate={anchorStr}
              schedules={schedules}
              membersById={membersById}
              workspaceId={workspaceId}
              highlightId={params.highlight}
              monthTodos={monthTodos}
              overdueTodos={overdueTodos}
              members={members}
              target={params.target ?? "all"}
            />
          )}
          {view === "week" && (
            <WeekView
              weekDates={getWeekDates(anchor)}
              schedules={schedules}
              membersById={membersById}
              workspaceId={workspaceId}
              weekTodos={monthTodos}
              overdueTodos={overdueTodos}
              members={members}
              target={params.target ?? "all"}
            />
          )}
          {view === "year" && (
            <YearView
              anchorDate={anchorStr}
              schedules={schedules}
              membersById={membersById}
              keywordMain={params.keywordMain}
              workspaceId={workspaceId}
              members={members}
              target={params.target ?? "all"}
            />
          )}
        </section>
      </ScrollRegion>

      <AddEventEntry
        workspaceId={workspaceId}
        members={members}
        defaultDate={anchorStr}
        autoOpen={params.new === "1"}
      />
      <AgentLauncher workspaceId={workspaceId} members={members} currentMemberId={myMember?.id ?? ""} />
    </TabPageFrame>
  );
}
