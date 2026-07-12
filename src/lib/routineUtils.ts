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

/** 종료 ≤ 시작이면 자정을 넘겨 다음 날 종료로 해석한다(예: 21:00~07:30, "잠").
 * 시작=종료(0분짜리)는 overnight이 아니라 그냥 잘못된 블록이므로 여기선 다루지 않는다
 * (그건 호출부의 저장 검증에서 막는다). */
export function isOvernightBlock(block: Pick<RoutineBlock, "start" | "end">) {
  return toMinutes(block.end) <= toMinutes(block.start);
}

/** 목록/도넛 등에서 보여줄 시간 범위 문자열 — overnight이면 "21:00 – 다음날 07:30"처럼
 * 다음 날임을 명시한다. */
export function formatBlockTimeRange(block: Pick<RoutineBlock, "start" | "end">) {
  return isOvernightBlock(block)
    ? `${block.start} – 다음날 ${block.end}`
    : `${block.start} – ${block.end}`;
}

/** "이 요일 자신의 블록 목록" 안에서 지금 진행 중인 블록을 찾는다. overnight 블록은 자정을
 * 넘겨 다음 날 24:00 이후까지로 끝을 늘려서 비교하지만, 어디까지나 "오늘 시작해서 아직 안
 * 끝난" 경우만 매칭한다 — 아직 시작 전인(예: 오늘 밤 9시에 시작할 예정인) overnight 블록을
 * 이른 새벽에 미리 매칭해버리는 걸 막기 위해 단일 조건만 쓴다(예전엔 nowMinutes+24h 조건을
 * 추가로 OR 했는데, 그러면 "오늘 자정 넘기는 블록"과 "어제 자정 넘겨 지금 이어지는 블록"을
 * 구분하지 못해 시작 전 블록도 활성으로 잘못 판정했음). 어제 블록에서 넘어와 지금 이어지는
 * 경우는 getCarriedOvernightBlock()이 별도로 처리한다. */
export function getCurrentBlock(
  blocks: RoutineBlock[],
  now = new Date()
): RoutineBlock | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    blocks.find((block) => {
      const start = toMinutes(block.start);
      let end = toMinutes(block.end);
      if (end <= start) end += 24 * 60;
      return nowMinutes >= start && nowMinutes < end;
    }) ?? null
  );
}

/** 홈 가족상태처럼 "오늘 요일" 블록만으로는 새벽 시간대에 전날 밤 시작한 overnight 블록(예:
 * 어제 21:00~07:30)을 놓치는 문제를 보정 — 어제 요일의 블록 중 overnight인 것만, 자정을
 * 넘겨 지금까지 이어지고 있는지 확인한다. 어제 블록의 일반(overnight 아닌) 항목은 절대
 * 매칭하지 않는다 — 우연히 지금 시각과 어제의 어느 시간대가 같다고 해서 오늘과 무관한 어제
 * 블록을 "지금 진행 중"으로 잘못 보여주면 안 되기 때문. */
export function getCarriedOvernightBlock(
  yesterdayBlocks: RoutineBlock[],
  now = new Date()
): RoutineBlock | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    yesterdayBlocks.find((block) => {
      if (!isOvernightBlock(block)) return false;
      const start = toMinutes(block.start);
      const end = toMinutes(block.end) + 24 * 60;
      return nowMinutes + 24 * 60 >= start && nowMinutes + 24 * 60 < end;
    }) ?? null
  );
}
