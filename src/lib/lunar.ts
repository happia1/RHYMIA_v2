/** 음력 변환 유틸 — `Intl.DateTimeFormat`의 단기(dangi, 한국 전통 음력) 캘린더를 사용한다.
 * 별도 룩업 테이블/외부 라이브러리 없이 브라우저·Node의 ICU 데이터에 의존하므로,
 * dangi 캘린더를 지원하지 않는 런타임에서는 모든 함수가 조용히 null을 반환한다 —
 * 호출부는 null을 "음력 표기/전개 생략"으로 처리해야 한다. */

export interface LunarDate {
  month: number;
  day: number;
  isLeap: boolean;
}

let dangiSupported: boolean | null = null;

function checkDangiSupport(): boolean {
  if (dangiSupported !== null) return dangiSupported;
  try {
    const parts = new Intl.DateTimeFormat("ko-u-ca-dangi", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
    // dangi 캘린더의 "연도" 파트는 표준 "year"가 아니라 "relatedYear"로 나온다(실측 확인).
    // year는 안 쓰므로 실제로 파싱에 쓰는 month/day 파트가 있는지로 지원 여부를 판단한다.
    dangiSupported = parts.some((p) => p.type === "month") && parts.some((p) => p.type === "day");
  } catch {
    dangiSupported = false;
  }
  return dangiSupported;
}

/** "YYYY-MM-DD" 문자열로 만든 Date(=UTC 자정)를 기대한다 — 이 모듈의 모든 함수가
 * 이 규약을 공유하며, 그 외 형태로 만든 Date를 넘기면 로컬 타임존에 따라
 * 하루가 밀릴 수 있다(이 앱의 date_start 등 날짜 문자열은 전부 이 규약을 따름). */
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** 캘린더에 따라 "월" 파트 표기가 다를 수 있어(예: 평달 "6" vs 윤달 "윤6"/"6bis" 등)
 * 방어적으로 파싱한다 — 숫자만 뽑아 month로, "윤"/leap 표기가 있으면 isLeap=true. */
function parseMonthPart(raw: string): { month: number; isLeap: boolean } {
  const isLeap = raw.includes("윤") || /leap/i.test(raw) || raw.includes("閏");
  const numeric = raw.replace(/[^0-9]/g, "");
  return { month: Number(numeric), isLeap };
}

/** 양력 날짜 → 음력 { month, day, isLeap }. dangi 캘린더 미지원 런타임이면 null. */
export function solarToLunar(date: Date): LunarDate | null {
  if (!checkDangiSupport()) return null;

  try {
    const parts = new Intl.DateTimeFormat("ko-u-ca-dangi", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(toUtcMidnight(date));

    const monthRaw = parts.find((p) => p.type === "month")?.value;
    const dayRaw = parts.find((p) => p.type === "day")?.value;
    if (!monthRaw || !dayRaw) return null;

    const { month, isLeap } = parseMonthPart(monthRaw);
    const day = Number(dayRaw.replace(/[^0-9]/g, ""));
    if (!month || !day) return null;

    return { month, day, isLeap };
  } catch {
    return null;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStrUtc(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function isSolarLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// 연도별 "음력 월-일(평달만) → 양력 날짜 문자열" 매핑 캐시. null이면 이 런타임에서
// dangi 캘린더를 아예 못 만든다는 뜻(매번 다시 시도하지 않도록 결과도 캐시해둔다).
const yearMapCache = new Map<number, Map<string, string> | null>();

// 알려진 한계: 음력 11·12월은 양력으로 다음 해 1~2월까지 넘어가는 경우가 있어, 어떤
// 양력 연도 하나에 "같은 음력 11월/12월"이 두 번(그 해 초의 전년도분 + 그 해 말의 해당분)
// 나타날 수 있다. 지금은 map.set이 first-wins(먼저 채워진 값 유지)라 두 번째(그 해 말) 발생분이
// 덮어써지지 않고 누락될 수 있다 — 예: 음력 11·12월에 있는 기념일의 "그 해 12월 발생분"이
// lunarToSolarInYear(그 해, 11 또는 12, day)에서 조회되지 않을 수 있음. 필요해지면 값을
// string[]로 바꿔 두 발생분을 모두 담고 호출부가 범위에 맞는 쪽을 고르게 확장할 것.
function buildYearMap(solarYear: number): Map<string, string> | null {
  const cached = yearMapCache.get(solarYear);
  if (cached !== undefined) return cached;

  if (!checkDangiSupport()) {
    yearMapCache.set(solarYear, null);
    return null;
  }

  const map = new Map<string, string>();
  const daysInYear = isSolarLeapYear(solarYear) ? 366 : 365;
  const jan1 = new Date(Date.UTC(solarYear, 0, 1));

  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(jan1);
    d.setUTCDate(jan1.getUTCDate() + i);

    const lunar = solarToLunar(d);
    if (!lunar || lunar.isLeap) continue; // 윤달은 건너뛰고 평달만 매칭

    const key = `${lunar.month}-${lunar.day}`;
    if (!map.has(key)) map.set(key, toDateStrUtc(d));
  }

  yearMapCache.set(solarYear, map);
  return map;
}

/** 주어진 양력 연도 안에서 (음력 lunarMonth월 lunarDay일, 평달 기준)에 해당하는
 * 양력 날짜("YYYY-MM-DD")를 찾는다. 그 해 그 달이 작은달이라 lunarDay가 없으면
 * (예: 음력 30일인데 그 달은 29일까지만 있음) 29일로 폴백. dangi 미지원이거나
 * 매핑을 아예 못 만들면 null. */
export function lunarToSolarInYear(
  solarYear: number,
  lunarMonth: number,
  lunarDay: number
): string | null {
  const map = buildYearMap(solarYear);
  if (!map) return null;

  return map.get(`${lunarMonth}-${lunarDay}`) ?? map.get(`${lunarMonth}-29`) ?? null;
}
