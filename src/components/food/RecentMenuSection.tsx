"use client";

import { useEffect, useState } from "react";
import { getRecentMeals } from "@/app/(main)/food/actions";
import { mirror } from "@/lib/homeTheme";
import type { Meal } from "@/types";

function menuLabel(meal: Meal) {
  return [meal.main_menu, ...meal.sides].filter(Boolean).join(", ");
}

/** 끼니 추가 화면의 "최근 먹은 메뉴" — 최근 3일간 먹은 메뉴를 자주 찾는 메뉴(FrequentMenuSection)
 * 와 같은 "칩 탭 = 채워넣기" 인터랙션으로 보여준다. 다만 그쪽은 식탁 탭 빈 화면에서 별도
 * 페이지(끼니 추가)로 이동해야 해서 메뉴 이름만 URL로 넘기지만, 여기는 이미 끼니 추가
 * 화면 "안"이라 라우팅 없이 onSelect 콜백으로 폼 상태(메뉴/이미지/레시피 등)를 그 자리에서
 * 즉시 채운다. 목록도 "그동안 등록된 전체 메뉴"처럼 길지 않고 최근 며칠 치뿐이라 가로
 * 마퀴 대신 줄바꿈 가능한 칩 목록으로 단순화했다. */
export function RecentMenuSection({
  workspaceId,
  onSelect,
}: {
  workspaceId: string;
  onSelect: (meal: Meal) => void;
}) {
  const [meals, setMeals] = useState<Meal[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecentMeals(workspaceId).then((result) => {
      if (!cancelled) setMeals(result);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!meals || meals.length === 0) return null;

  return (
    // 아래(끼니 섹션)에는 구분선이 없으므로, 이 섹션이 실제로 렌더될 때만 스스로 아랫단에
    // 구분선을 그린다 — 렌더링 여부를 모르는 부모가 먼저 구분선을 깔아두면, 최근 3일간
    // 기록이 없어 이 섹션이 통째로 null을 반환하는 날엔 구분선만 붕 뜬 채 남게 된다.
    <section className="flex flex-col gap-2 border-b-[0.5px] border-border-light pb-4">
      <span className={mirror.label}>최근 먹은 메뉴</span>
      <div className="flex flex-wrap gap-2">
        {meals.map((meal) => (
          <button
            key={meal.id}
            onClick={() => onSelect(meal)}
            className="flex items-center gap-1.5 rounded-full border border-border-light py-1 pl-1 pr-3 text-[12px] text-ink"
          >
            {meal.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={meal.image_url} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[11px]">
                {meal.emoji}
              </span>
            )}
            {menuLabel(meal)}
          </button>
        ))}
      </div>
    </section>
  );
}
