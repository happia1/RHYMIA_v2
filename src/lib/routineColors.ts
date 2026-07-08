/** 상태별 24h 원형 차트 색상 — globals.css의 --routine-* 변수(라이트/다크 대응)를 가리킨다. */
export const STATUS_COLOR_VAR: Record<string, string> = {
  업무: "--routine-work",
  수업: "--routine-class",
  운동: "--routine-exercise",
  공부: "--routine-study",
  휴식: "--routine-rest",
  취침: "--routine-sleep",
  이동: "--routine-commute",
  커스텀: "--routine-custom",
};

export const DEFAULT_STATUS_COLOR_VAR = "--routine-custom";
