export interface WeatherData {
  tempC: number;
  tempMinC: number | null;
  tempMaxC: number | null;
  description: string;
  icon: string;
  location: string;
}

// 위치는 서울 강동구로 고정 (워크스페이스별 위치 설정 기능은 범위 밖)
const LAT = 37.5301;
const LON = 127.1238;
const LOCATION_LABEL = "서울 강동구";
// 외부 API가 응답 없이 멈추면 홈 화면 렌더링 전체가 함께 무한 대기하게 된다 — 타임아웃으로 끊어낸다.
const FETCH_TIMEOUT_MS = 4000;

const WEATHER_EMOJI: Record<string, string> = {
  "01d": "☀️", "01n": "🌙",
  "02d": "⛅", "02n": "☁️",
  "03d": "☁️", "03n": "☁️",
  "04d": "☁️", "04n": "☁️",
  "09d": "🌧️", "09n": "🌧️",
  "10d": "🌦️", "10n": "🌧️",
  "11d": "⛈️", "11n": "⛈️",
  "13d": "❄️", "13n": "❄️",
  "50d": "🌫️", "50n": "🌫️",
};

// KST(UTC+9)는 서머타임이 없어 이 단순 shift만으로도 안전하게 "오늘" 날짜 문자열을 구할 수 있다.
function todayKstStr(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 무료 티어(/data/2.5/forecast, 3시간 간격 5일 예보)에서 "오늘" 남은 구간의 min/max만 뽑는다.
 * One Call 3.0의 daily.temp.min/max처럼 하루 전체를 보장하진 않음(이미 지난 시간대는
 * 예보 목록에 없음) — 유료 구독 없이 얻을 수 있는 근사치라는 한계를 감안한 것. 실패 시
 * null/null을 반환해 호출부가 min/max 줄만 조용히 생략하게 한다. */
async function getTodayMinMax(apiKey: string): Promise<{ min: number | null; max: number | null }> {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&units=metric&appid=${apiKey}`,
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    if (!res.ok) return { min: null, max: null };

    const data = await res.json();
    const today = todayKstStr();
    const todayTemps: number[] = (data.list ?? [])
      .filter((entry: { dt_txt?: string }) => entry.dt_txt?.startsWith(today))
      .map((entry: { main?: { temp?: number } }) => entry.main?.temp)
      .filter((t: number | undefined): t is number => t !== undefined);

    if (todayTemps.length === 0) return { min: null, max: null };
    return {
      min: Math.round(Math.min(...todayTemps)),
      max: Math.round(Math.max(...todayTemps)),
    };
  } catch {
    return { min: null, max: null };
  }
}

export async function getCurrentWeather(): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const [res, minMax] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&lang=kr&appid=${apiKey}`,
        { next: { revalidate: 600 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
      ),
      getTodayMinMax(apiKey),
    ]);
    if (!res.ok) return null;

    const data = await res.json();
    const icon = data.weather?.[0]?.icon as string | undefined;
    const description = data.weather?.[0]?.description as string | undefined;
    const temp = data.main?.temp as number | undefined;

    if (temp === undefined || !description) return null;

    return {
      tempC: Math.round(temp),
      tempMinC: minMax.min,
      tempMaxC: minMax.max,
      description,
      icon: (icon && WEATHER_EMOJI[icon]) ?? "🌤️",
      location: LOCATION_LABEL,
    };
  } catch {
    return null;
  }
}
