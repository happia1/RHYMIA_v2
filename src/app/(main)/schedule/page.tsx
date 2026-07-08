import { IconCalendar } from "@tabler/icons-react";
import { requireWorkspaceContext } from "@/lib/workspace";
import { toDateStr, getWeekDates } from "@/lib/date";
import { getCurrentBlock, STATUS_EMOJI, DEFAULT_STATUS_EMOJI } from "@/lib/routineUtils";
import { getCurrentWeather } from "@/lib/weather";
import { ScheduleTabs } from "@/components/schedule/ScheduleTabs";
import { EventFilters } from "@/components/schedule/EventFilters";
import { MonthView } from "@/components/schedule/MonthView";
import { WeekView } from "@/components/schedule/WeekView";
import { YearView } from "@/components/schedule/YearView";
import { AddEventEntry } from "@/components/schedule/AddEventEntry";
import { AgentLauncher } from "@/components/agent/AgentLauncher";
import { SectionLabel } from "@/components/home/SectionLabel";
import type { Schedule } from "@/types";

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

  const [{ data: memberRows }, { data: scheduleRows }, weather, { data: myRoutineRows }] =
    await Promise.all([
      supabase
        .from("workspace_member")
        .select("user_id, display_name, users(avatar_color, avatar_text_color)")
        .eq("workspace_id", workspaceId),
      supabase
        .from("schedule")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("date_start", range.start)
        .lte("date_start", range.end)
        .or(`is_shared.eq.true,author_id.eq.${user.id}`)
        .order("date_start", { ascending: true }),
      getCurrentWeather(),
      supabase
        .from("routine")
        .select("blocks")
        .eq("user_id", user.id)
        .eq("day_of_week", today.getDay()),
    ]);

  const members = (memberRows ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      user_id: m.user_id as string,
      display_name: m.display_name ?? "가족",
      avatar_color: u?.avatar_color ?? "#E1F5EE",
      avatar_text_color: u?.avatar_text_color ?? "#0F6E56",
    };
  });

  let schedules = (scheduleRows ?? []) as Schedule[];

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

  const myBlocks = (myRoutineRows ?? []).flatMap((r) => (r.blocks as never[]) ?? []);
  const myBlock = getCurrentBlock(myBlocks as never, today);
  const myStatusText = myBlock
    ? `${STATUS_EMOJI[(myBlock as { status: string }).status] ?? DEFAULT_STATUS_EMOJI} ${(myBlock as { label: string }).label}`
    : `${DEFAULT_STATUS_EMOJI} 쉬는 중`;

  const membersById = Object.fromEntries(members.map((m) => [m.user_id, m]));

  return (
    <div className="flex flex-col gap-section px-4 pb-24 pt-6">
      <ScheduleTabs anchorDate={anchorStr} view={view} myStatusText={myStatusText} />
      <EventFilters
        members={members}
        scope={params.scope ?? "all"}
        target={params.target ?? "all"}
        keywordMain={params.keywordMain}
        keywordSub={params.keywordSub}
      />

      <div className="h-px w-full bg-border-light" />

      <section className="flex flex-col gap-label-gap">
        <SectionLabel icon={IconCalendar}>{VIEW_LABEL[view]}</SectionLabel>
        <div className="pl-section-indent">
          {view === "month" && (
            <MonthView anchorDate={anchorStr} schedules={schedules} membersById={membersById} />
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
      <AgentLauncher workspaceId={workspaceId} members={members} />
    </div>
  );
}
