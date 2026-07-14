"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import { getTopFrequentMenus } from "@/app/(main)/food/actions";

// 한 바퀴 도는 데 걸리는 시간 — 너무 빠르면 정신없고 너무 느리면 안 움직이는 것처럼 보임.
const MARQUEE_DURATION_S = 32;

function MarqueeRow({ menus, onSelect }: { menus: string[]; onSelect: (menu: string) => void }) {
  const [playing, setPlaying] = useState(true);

  if (menus.length === 0) return null;

  // 콘텐츠를 두 벌 이어 붙이고 -50%까지 옮기면 이음매 없이 반복되는 것처럼 보인다.
  const loopMenus = [...menus, ...menus];

  return (
    <div
      className="scrollbar-hide overflow-x-auto"
      onTouchStart={() => setPlaying(false)}
      onPointerDown={() => setPlaying(false)}
    >
      <div
        className="flex w-max gap-2"
        style={{
          animation: `marquee ${MARQUEE_DURATION_S}s linear infinite`,
          animationPlayState: playing ? "running" : "paused",
        }}
      >
        {loopMenus.map((menu, i) => (
          <button
            key={`${menu}-${i}`}
            onClick={() => onSelect(menu)}
            className="shrink-0 rounded-full border border-border-light px-3 py-1.5 text-[12px] text-ink"
          >
            {menu}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "늘 먹던 걸로"를 대체 — 기본은 "자주 찾는 메뉴 ▸" 라벨만 보이는 접힘 상태, 펼치면 그동안
 * 등록된 메뉴 전체를 빈도순으로 2줄 마퀴로 흘려 보여준다. 자동으로 오른쪽→왼쪽 스크롤하다가
 * 사용자가 터치하는 순간 그 자리에서 멈추고(스크롤 위치 점프 없이) 좌우 스와이프로 직접
 * 탐색 가능한 일반 가로 스크롤로 바뀐다. 메뉴를 탭하면 그 이름을 프리필한 끼니 등록 화면으로
 * 이동(즉시 등록이 아니라 사용자가 확인 후 등록하도록). */
export function FrequentMenuSection({
  workspaceId,
  selectedDate,
}: {
  workspaceId: string;
  selectedDate: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [menus, setMenus] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTopFrequentMenus(workspaceId).then((result) => {
      if (!cancelled) setMenus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (menus !== null && menus.length === 0) return null;

  const rowA = (menus ?? []).filter((_, i) => i % 2 === 0);
  const rowB = (menus ?? []).filter((_, i) => i % 2 === 1);

  const handleSelect = (menu: string) => {
    router.push(`/food/add?date=${selectedDate}&menu=${encodeURIComponent(menu)}`);
  };

  return (
    // w-full: 부모(MealEmptyState)가 items-center라 명시적 너비가 없으면 이 컨테이너가
    // 콘텐츠 크기로 줄어들어 아래 마퀴의 overflow-x-auto가 잘라낼 기준 폭 자체를 못 잡는다.
    <div className="flex w-full flex-col items-center gap-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-0.5 text-[11px] text-[var(--text-muted)]"
      >
        자주 찾는 메뉴
        <IconChevronRight size={11} className={expanded ? "rotate-90" : ""} />
      </button>
      {expanded && (
        <div className="flex w-full flex-col gap-2">
          <MarqueeRow menus={rowA} onSelect={handleSelect} />
          <MarqueeRow menus={rowB} onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
}
