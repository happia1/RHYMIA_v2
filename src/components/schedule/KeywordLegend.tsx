import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";

/** 일정 탭 월간 뷰 전용 키워드 색 범례 — 원래 달력 하단에 있었는데, 섹션 상단(멤버 필터
 * 드롭다운과 같은 줄) 왼쪽으로 옮겨왔다(schedule/page.tsx). 좁은 화면에서 6개 항목이
 * 드롭다운과 한 줄에 들어가야 해서 줄바꿈 대신 가로 스크롤로 처리한다. */
export function KeywordLegend() {
  return (
    <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
      {KEYWORD_GROUPS.map((g) => (
        <span
          key={g.main}
          className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--text-muted)]"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
          {g.main}
        </span>
      ))}
    </div>
  );
}
