"use client";

import { IconCheck } from "@tabler/icons-react";

// 도트(시점 일정)·바(기간 일정)·체크 원(할 일)이 전부 이 폭 안에서 중앙 정렬돼, 뒤따르는
// 텍스트의 시작점이 마커 종류와 무관하게 항상 같은 자리에서 시작한다 — 홈(TodayEvents)에서
// 먼저 확립한 슬롯 규칙을 전 화면 공통 컴포넌트로 승격한 것.
const MARKER_SLOT = "flex h-4 w-4 shrink-0 items-center justify-center";

export function EventMarker({
  type,
  color,
  done,
}: {
  type: "dot" | "bar" | "check";
  /** dot·bar 전용 — 일정의 키워드 색 */
  color?: string;
  /** check 전용 — 완료 여부 */
  done?: boolean;
}) {
  if (type === "check") {
    return (
      <span className={MARKER_SLOT}>
        <span
          className={`flex h-3 w-3 items-center justify-center rounded-full border ${
            done ? "border-sage bg-sage" : "border-border-light"
          }`}
        >
          {done && <IconCheck size={7} className="text-white" stroke={3.5} />}
        </span>
      </span>
    );
  }
  return (
    <span className={MARKER_SLOT}>
      {type === "bar" ? (
        <span className="h-[2px] w-2 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="h-[3px] w-[3px] rounded-full" style={{ backgroundColor: color }} />
      )}
    </span>
  );
}
