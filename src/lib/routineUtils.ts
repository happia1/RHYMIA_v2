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
      let end = toMinutes(block.end);
      if (end <= start) end += 24 * 60; // 자정을 넘기는 블록(예: 21:00~07:30, "잠")
      // 자정 넘김 블록은 "지금"이 자정 이후 이른 새벽일 때도 걸려야 하므로 하루를 더한
      // nowMinutes로도 함께 확인한다(예: 새벽 3시=180분이 전날 21시~다음날 7시반 블록에 속하는지).
      return (
        (nowMinutes >= start && nowMinutes < end) ||
        (nowMinutes + 24 * 60 >= start && nowMinutes + 24 * 60 < end)
      );
    }) ?? null
  );
}
