export interface WeatherData {
  tempC: number;
  description: string;
  icon: string;
}

// 위치는 서울로 고정 (워크스페이스별 위치 설정 기능은 범위 밖)
const LAT = 37.5665;
const LON = 126.978;

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

export async function getCurrentWeather(): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&lang=kr&appid=${apiKey}`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const icon = data.weather?.[0]?.icon as string | undefined;
    const description = data.weather?.[0]?.description as string | undefined;
    const temp = data.main?.temp as number | undefined;

    if (temp === undefined || !description) return null;

    return {
      tempC: Math.round(temp),
      description,
      icon: (icon && WEATHER_EMOJI[icon]) ?? "🌤️",
    };
  } catch {
    return null;
  }
}
