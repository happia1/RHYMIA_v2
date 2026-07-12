/** 반복 일정(monthly/yearly) 가상 전개 유틸 — DB에는 원본 한 행만 저장하고,
 * 화면에 보여줄 범위([rangeStart, rangeEnd])만큼만 그때그때 인스턴스를 계산해 만든다.
 * weekly는 다루지 않는다(루틴 담당) — RecurType 자체에 값이 없음. */

import { solarToLunar, lunarToSolarInYear } from "@/lib/lunar";
import type { Schedule } from "@/types";

/** 가상 인스턴스는 원본 Schedule의 모든 필드를 그대로 복사하고 date_start/date_end,
 * id(합성 id — 진짜 row가 아니므로)만 바꾼 뒤 isVirtual/originalId를 덧붙인다.
 * isVirtual/originalId를 옵셔널로 둬서 일반 Schedule[]도 그대로 대입 가능하게 한다
 * (화면 컴포넌트들이 Schedule[]을 받는 기존 prop 타입을 바꾸지 않아도 되도록). */
export interface ExpandedSchedule extends Schedule {
  isVirtual?: boolean;
  /** 가상 인스턴스일 때만 존재 — 실제 저장된 원본 schedule.id.
   * 수정 시트가 가상 인스턴스를 열면 이 id로 원본을 수정해야 한다(수정 화면 자체는
   * 다음 작업에서 구현 — 여기서는 데이터만 준비해둔다). */
  originalId?: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function monthIndex(year: number, month0: number) {
  return year * 12 + month0;
}

/** "YYYY-MM-DD" 문자열 → UTC 자정 Date (이 앱의 날짜 문자열 규약과 동일) */
function parseDateStr(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dateDiffInDays(startStr: string, endStr: string): number {
  const start = parseDateStr(startStr);
  const end = parseDateStr(endStr);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function makeVirtualInstance(
  schedule: Schedule,
  newStart: string,
  hasRange: boolean,
  durationDays: number
): ExpandedSchedule {
  return {
    ...schedule,
    id: `${schedule.id}__${newStart}`,
    date_start: newStart,
    date_end: hasRange ? addDaysToDateStr(newStart, durationDays) : null,
    isVirtual: true,
    originalId: schedule.id,
  };
}

/** 후보 날짜 하나가 실제로 결과에 들어가도 되는지 공통 검사 —
 * 원본 자신은 중복 생성 금지, 범위/종료일(recur_until) 안쪽인지, 원본보다 이전은 아닌지. */
function isEligible(
  candidate: string,
  schedule: Schedule,
  rangeStart: string,
  rangeEnd: string
): boolean {
  if (candidate === schedule.date_start) return false; // 원본 자체는 별도 조회에서 이미 나옴
  if (candidate < schedule.date_start) return false; // 반복은 원본 등록일 이후로만 전개
  if (candidate < rangeStart || candidate > rangeEnd) return false;
  if (schedule.recur_until && candidate > schedule.recur_until) return false;
  return true;
}

function expandMonthly(
  schedule: Schedule,
  rangeStart: string,
  rangeEnd: string,
  hasRange: boolean,
  durationDays: number
): ExpandedSchedule[] {
  const results: ExpandedSchedule[] = [];
  const anchor = parseDateStr(schedule.date_start);
  const anchorDay = anchor.getUTCDate();
  const anchorIdx = monthIndex(anchor.getUTCFullYear(), anchor.getUTCMonth());

  const rangeStartDate = parseDateStr(rangeStart);
  const rangeEndDate = parseDateStr(rangeEnd);
  const startIdx = Math.max(
    anchorIdx,
    monthIndex(rangeStartDate.getUTCFullYear(), rangeStartDate.getUTCMonth())
  );
  const endIdx = monthIndex(rangeEndDate.getUTCFullYear(), rangeEndDate.getUTCMonth());

  for (let idx = startIdx; idx <= endIdx; idx++) {
    const year = Math.floor(idx / 12);
    const month0 = idx % 12;
    // 없는 일자(31일 등)는 그 달 말일로 클램프
    const clampedDay = Math.min(anchorDay, daysInMonth(year, month0));
    const candidate = `${year}-${pad2(month0 + 1)}-${pad2(clampedDay)}`;

    if (!isEligible(candidate, schedule, rangeStart, rangeEnd)) continue;
    results.push(makeVirtualInstance(schedule, candidate, hasRange, durationDays));
  }

  return results;
}

function expandYearlySolar(
  schedule: Schedule,
  rangeStart: string,
  rangeEnd: string,
  hasRange: boolean,
  durationDays: number
): ExpandedSchedule[] {
  const results: ExpandedSchedule[] = [];
  const anchor = parseDateStr(schedule.date_start);
  const anchorMonth0 = anchor.getUTCMonth();
  const anchorDay = anchor.getUTCDate();

  const startYear = Math.max(anchor.getUTCFullYear(), parseDateStr(rangeStart).getUTCFullYear());
  const endYear = parseDateStr(rangeEnd).getUTCFullYear();

  for (let year = startYear; year <= endYear; year++) {
    // 2/29는 평년에 2/28로 클램프
    const clampedDay = Math.min(anchorDay, daysInMonth(year, anchorMonth0));
    const candidate = `${year}-${pad2(anchorMonth0 + 1)}-${pad2(clampedDay)}`;

    if (!isEligible(candidate, schedule, rangeStart, rangeEnd)) continue;
    results.push(makeVirtualInstance(schedule, candidate, hasRange, durationDays));
  }

  return results;
}

function expandYearlyLunar(
  schedule: Schedule,
  rangeStart: string,
  rangeEnd: string,
  hasRange: boolean,
  durationDays: number
): ExpandedSchedule[] {
  const anchor = parseDateStr(schedule.date_start);
  const lunarAnchor = solarToLunar(anchor);
  if (!lunarAnchor) return []; // 이 런타임에서 음력 변환 불가 — 전개 생략

  const results: ExpandedSchedule[] = [];
  const startYear = Math.max(anchor.getUTCFullYear(), parseDateStr(rangeStart).getUTCFullYear());
  const endYear = parseDateStr(rangeEnd).getUTCFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const candidate = lunarToSolarInYear(year, lunarAnchor.month, lunarAnchor.day);
    if (!candidate) continue;
    if (!isEligible(candidate, schedule, rangeStart, rangeEnd)) continue;
    results.push(makeVirtualInstance(schedule, candidate, hasRange, durationDays));
  }

  return results;
}

/** schedules 중 recur_type이 monthly/yearly인 것들만 골라 [rangeStart, rangeEnd] 구간에
 * 해당하는 가상 인스턴스를 만들어 반환한다. recur_type='none'인 일정은 무시(원본이
 * 이미 일반 조회에 포함되므로). 원본 자체가 이 범위에 들어와도 중복 생성하지 않는다 —
 * 호출부가 "기존 범위 조회 결과"와 이 함수의 반환값을 합쳐야 원본+반복 인스턴스가 모두 나온다. */
export function expandRecurring(
  schedules: Schedule[],
  rangeStart: string,
  rangeEnd: string
): ExpandedSchedule[] {
  const results: ExpandedSchedule[] = [];

  for (const schedule of schedules) {
    if (!schedule.recur_type || schedule.recur_type === "none") continue;

    const hasRange = !!schedule.date_end;
    const durationDays = hasRange ? dateDiffInDays(schedule.date_start, schedule.date_end!) : 0;

    if (schedule.recur_type === "monthly") {
      results.push(...expandMonthly(schedule, rangeStart, rangeEnd, hasRange, durationDays));
    } else if (schedule.recur_type === "yearly") {
      if (schedule.recur_calendar === "lunar") {
        results.push(...expandYearlyLunar(schedule, rangeStart, rangeEnd, hasRange, durationDays));
      } else {
        results.push(...expandYearlySolar(schedule, rangeStart, rangeEnd, hasRange, durationDays));
      }
    }
  }

  return results;
}
