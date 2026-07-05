export function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
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
