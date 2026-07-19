"use client";

import { getKeywordColor } from "@/lib/scheduleKeywords";
import { getHoliday } from "@/lib/holidays";
import type { ExpandedSchedule } from "@/lib/recurrence";

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 기간 밴드는 겹쳐도 최대 이 줄 수까지만 라인으로 그린다 — 넘치는 일정은 라인은 없지만
// 조합 라벨 텍스트(예: "여름특강/유치원방학")에는 이름이 계속 포함된다.
export const MAX_BAND_ROWS = 2;
// 라인 두께·줄 간격 — 실제 렌더 크기(h-[2px], gap 2px)와 반드시 일치해야 라벨/라인 스택
// 높이 계산이 어긋나지 않는다.
const BAND_LINE_H = 2;
const BAND_LINE_GAP = 2;
const LINE_STACK_H = MAX_BAND_ROWS * BAND_LINE_H + (MAX_BAND_ROWS - 1) * BAND_LINE_GAP;
// 라인 스택과 라벨 사이 간격.
const BAND_LABEL_GAP = 2.5;
// 라벨 한 줄을 위해 항상 미리 예약해두는 세로 공간(라벨이 없는 날에도 동일하게 예약) —
// 이래야 라벨 유무와 무관하게 모든 셀의 행 높이가 완전히 똑같이 유지된다(레이어 분리).
const BAND_LABEL_ZONE_H = 11;

export type BandEntry = {
  color: string;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
  title: string;
};

export type LabelOccurrence = { title: string; color: string; spanCells: number };

// 0=일 ... 6=토 (JS Date와 동일 규약).
export function dowOf(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
}

// 요일/공휴일 색 — 다크 배경에서 눈에 편한 저채도 톤을 쓰기 위해 원색 대신 기존 브랜드
// 토큰(ocean/terra)을 재사용한다. 토요일은 ocean(파랑 계열), 일요일·공휴일은 terra(빨강
// 계열) — 우선순위는 호출부에서 today/selected보다 낮게 적용.
export function weekendColorClass(dateStr: string, holiday: string | null) {
  if (holiday || dowOf(dateStr) === 0) return "text-terra";
  if (dowOf(dateStr) === 6) return "text-ocean";
  return null;
}

/** 월간 달력 그리드(요일 헤더 + 날짜 셀 + 도트·기간 밴드 라인·라벨) — 모바일 월간 뷰가
 * 쓰던 렌더링을 그대로 뽑아낸 공용 컴포넌트다. 태블릿 좌측 패널도 별도로 재구현하지
 * 않고 이 컴포넌트를 그대로 재사용한다(MonthView.tsx 참고) — 도트/라인/라벨 규칙이
 * 화면 크기와 무관하게 항상 완전히 동일해야 하기 때문. `compressed`는 모바일에서 데이
 * 시트가 열려 달력이 50%로 압축될 때만 true(라벨 존을 접어 도트+라인만 남김) — 태블릿은
 * 시트 압축 개념이 없어 항상 false로 넘긴다. */
export function MonthCalendarGrid({
  cells,
  weekRows,
  todayStr,
  highlightedDate,
  dotsByDate,
  bandsByDate,
  labelsByDate,
  compressed = false,
  onSelectDate,
  onContainerClick,
  className = "",
}: {
  cells: (string | null)[];
  weekRows: number;
  todayStr: string;
  /** 링 하이라이트를 표시할 날짜 — 모바일은 시트가 열렸을 때만 selectedDate, 닫히면 null */
  highlightedDate: string | null;
  dotsByDate: Record<string, ExpandedSchedule[]>;
  bandsByDate: Record<string, BandEntry[]>;
  labelsByDate: Record<string, LabelOccurrence[]>;
  compressed?: boolean;
  onSelectDate: (date: string) => void;
  onContainerClick?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="grid shrink-0 grid-cols-7 pb-1 text-center">
        {WEEKDAY_LABELS.map((wd, i) => (
          <span
            key={wd}
            className={`text-[13px] ${
              i === 6 ? "text-terra" : i === 5 ? "text-ocean" : "text-[var(--text-muted)]"
            }`}
          >
            {wd}
          </span>
        ))}
      </div>

      <div
        className="grid flex-1 grid-cols-7 gap-y-1 text-center"
        style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}
        onClick={onContainerClick}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const dotSchedules = dotsByDate[date] ?? [];
          const cellBands = (bandsByDate[date] ?? []).slice().sort((a, b) => a.lane - b.lane);
          const labelOccurrences = labelsByDate[date] ?? [];
          const grocery = dotSchedules.find((s) => s.is_grocery && s.amount);
          const isToday = date === todayStr;
          const isSelected = date === highlightedDate;
          const holiday = getHoliday(date);
          const weekendClass = weekendColorClass(date, holiday);

          // 라벨은 최대 1개 — 그 위치(시작일/주 첫 셀)에 걸친 기간이 하나면 자기 이름,
          // 둘 이상이면 "이름/이름" 조합(줄별 개별 표기 없음).
          let labelNode: React.ReactNode = null;
          if (labelOccurrences.length === 1) {
            const occ = labelOccurrences[0];
            labelNode = (
              <span
                className="pointer-events-none absolute left-0 truncate text-left text-[10px] leading-none"
                style={{
                  bottom: LINE_STACK_H + BAND_LABEL_GAP,
                  width: `calc(${occ.spanCells * 100}% - 4px)`,
                  color: occ.color,
                  opacity: 0.55,
                }}
              >
                {occ.title}
              </span>
            );
          } else if (labelOccurrences.length >= 2) {
            const maxSpanCells = Math.max(...labelOccurrences.map((occ) => occ.spanCells));
            labelNode = (
              <span
                className="pointer-events-none absolute left-0 truncate text-left text-[10px] leading-none"
                style={{
                  bottom: LINE_STACK_H + BAND_LABEL_GAP,
                  width: `calc(${maxSpanCells * 100}% - 4px)`,
                }}
              >
                {labelOccurrences.map((occ, oi) => (
                  <span key={oi}>
                    {oi > 0 && <span className="text-stone">/</span>}
                    <span style={{ color: occ.color, opacity: 0.55 }}>{occ.title}</span>
                  </span>
                ))}
              </span>
            );
          }

          return (
            <button
              key={date}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate(date);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 ${compressed ? "py-0" : "py-1"}`}
            >
              {/* 날짜 숫자 크기는 압축 여부와 무관하게 항상 동일 — 압축은 아래 부가 영역만 줄인다. */}
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[16px] ${
                  isToday
                    ? "bg-honey/15 font-medium text-honey"
                    : isSelected
                    ? "font-medium text-honey ring-1 ring-honey/40"
                    : weekendClass
                    ? `font-medium ${weekendClass}`
                    : "text-ink"
                }`}
              >
                {Number(date.slice(-2))}
              </span>
              <div className="flex gap-1" style={{ minHeight: compressed ? 4 : 6 }}>
                {dotSchedules.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    className="h-[4px] w-[4px] rounded-full"
                    style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
                  />
                ))}
              </div>
              {grocery && !compressed && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {grocery.amount!.toLocaleString()}
                </span>
              )}
              {/* 라인은 텍스트 유무와 무관하게 항상 같은 두께로 렌더(레이어 분리) — 라벨은
                  별도 position:absolute 오버레이라 이 컨테이너의 문서 흐름(높이 계산)에는
                  전혀 관여하지 않는다. 라벨 한 줄분 공간(BAND_LABEL_ZONE_H)은 라벨이
                  실제로 있든 없든 항상 동일하게 예약해둬 셀마다 행 높이가 달라지지
                  않는다. 압축 모드일 땐 이 예약 공간을 0으로 접어 라벨을 완전히 숨기고
                  도트+라인만 남긴다.
                  flex-col-reverse: lane 0(그룹 내 가장 긴 기간, "맨 아래 레인")이 배열의
                  첫 항목이라 역방향 배치에서 셀 최하단에 오고, 그 위로 lane 1이 쌓인다. */}
              <span
                className="relative flex w-full flex-col-reverse"
                style={{
                  height: (compressed ? 0 : BAND_LABEL_ZONE_H) + LINE_STACK_H,
                  paddingTop: compressed ? 0 : BAND_LABEL_ZONE_H,
                  gap: BAND_LINE_GAP,
                }}
              >
                {cellBands.map((band) => (
                  <span
                    key={band.lane}
                    className={`h-[2px] ${band.isStart ? "rounded-l-full" : ""} ${
                      band.isEnd ? "rounded-r-full" : ""
                    }`}
                    style={{ backgroundColor: band.color, opacity: 0.55 }}
                  />
                ))}
                {!compressed && labelNode}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
