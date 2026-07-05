import type { RoutineBlock } from "@/types";

export const STATUS_OPTIONS = [
  "업무",
  "수업",
  "운동",
  "공부",
  "휴식",
  "취침",
  "이동",
  "커스텀",
] as const;

export const STATUS_EMOJI: Record<string, string> = {
  업무: "💼",
  수업: "📚",
  운동: "🏃",
  공부: "✏️",
  휴식: "🛋️",
  취침: "😴",
  이동: "🚗",
  커스텀: "✨",
};

export const DEFAULT_STATUS_EMOJI = "🫧";

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function getCurrentBlock(
  blocks: RoutineBlock[],
  now = new Date()
): RoutineBlock | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    blocks.find((block) => {
      const start = toMinutes(block.start);
      const end = toMinutes(block.end);
      return nowMinutes >= start && nowMinutes < end;
    }) ?? null
  );
}
