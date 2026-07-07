export const MEAL_TAGS = ["아침", "브런치", "점심", "간식", "저녁", "야식"] as const;

const TAG_HOUR: Record<string, number> = {
  아침: 7,
  브런치: 10,
  점심: 12,
  간식: 15,
  저녁: 18,
  야식: 21,
};

export function tagOrderIndex(tag: string) {
  const idx = MEAL_TAGS.indexOf(tag as (typeof MEAL_TAGS)[number]);
  return idx === -1 ? MEAL_TAGS.length : idx;
}

/** 태그별 기본 시각 표시 (예: "저녁" -> "18:00"). 실제 예약 시각이 있으면 그걸 우선 써야 한다. */
export function tagHourLabel(tag: string): string {
  const hour = TAG_HOUR[tag] ?? 0;
  return `${hour}:00`;
}

export function findUpcomingMeal<T extends { date: string; tag: string }>(
  meals: T[],
  now = new Date()
): T | null {
  const todayStr = now.toISOString().slice(0, 10);
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const sorted = [...meals].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return tagOrderIndex(a.tag) - tagOrderIndex(b.tag);
  });

  const upcoming = sorted.find((meal) => {
    if (meal.date > todayStr) return true;
    if (meal.date === todayStr) {
      return (TAG_HOUR[meal.tag] ?? 0) >= currentHour;
    }
    return false;
  });

  return upcoming ?? sorted[0] ?? null;
}
