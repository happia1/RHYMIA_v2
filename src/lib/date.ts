export const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

export function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> "2026년 7월" */
export function formatYearMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** dateStr 기준 월을 delta만큼 이동한 날짜 문자열(YYYY-MM-DD)을 반환합니다. */
export function addMonths(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + delta, 1);
  return toDateStr(d);
}

/** dateStr 기준 연도를 delta만큼 이동한 날짜 문자열(YYYY-MM-DD)을 반환합니다(연간 뷰 이동용). */
export function addYears(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + delta, d.getMonth(), 1);
  return toDateStr(d);
}

/** 오늘이면 "오후 3:20", 아니면 "7/6" 형태로 표시합니다 (게시판 작성 시각용). */
export function formatPostTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    const hours = d.getHours();
    const period = hours < 12 ? "오전" : "오후";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${period} ${hour12}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 월요일 시작 기준 이번 주 7일치 날짜 문자열(YYYY-MM-DD) 배열을 반환합니다. */
export function getWeekDates(base = new Date()): string[] {
  const day = base.getDay(); // 0=일 ... 6=토
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });
}
