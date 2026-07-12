"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { mirror } from "@/lib/homeTheme";
import type { Meal } from "@/types";

export interface MealSummaryItem extends Meal {
  participantNames: string[];
}

/** 홈은 "오늘 등록된 것만" 보여주는 상태판 — 끼니가 없으면 아무것도 표시하지 않는다.
 * 메뉴를 고르는 경험(빈 상태/추천/게임)은 식탁 탭이 전담한다. */
export function MealSummaryCard({ meals }: { meals: MealSummaryItem[] }) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (meals.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-label-gap">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
      >
        {meals.map((meal) => {
          const subline = [meal.sides.join(", "), meal.participantNames.join(", ")]
            .filter(Boolean)
            .join(" · ");

          return (
            <Link key={meal.id} href="/food" className="flex w-full shrink-0 snap-center flex-col gap-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className={`min-w-0 flex-1 truncate text-[16px] font-medium ${mirror.primary}`}>
                  {meal.emoji} {meal.main_menu}
                </span>
              </div>
              <div className={`text-[12px] ${mirror.secondary}`}>
                {meal.tag} · {meal.type}
                {meal.type === "외식" && meal.reservation_time
                  ? ` · ${meal.reservation_time}`
                  : ""}
              </div>
              {subline && (
                <div className={`text-[11px] ${mirror.muted}`}>+ {subline}</div>
              )}
            </Link>
          );
        })}
      </div>

      {meals.length > 1 && (
        <div className="flex gap-1.5">
          {meals.map((meal, i) => (
            <span
              key={meal.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-honey" : `w-1.5 ${mirror.hairlineBg}`
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
