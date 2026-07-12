"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { mirror } from "@/lib/homeTheme";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import type { Meal } from "@/types";

export interface MealSummaryParticipant {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
}

export interface MealSummaryItem extends Meal {
  participants: MealSummaryParticipant[];
}

// 18px 아바타를 4/5만큼 겹치는 음수 마진 — MealCard.tsx의 AVATAR_STACK_OVERLAP과 동일 비율
const AVATAR_STACK_OVERLAP = "-space-x-[14.4px]";

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
          const sidesText = meal.sides.join(", ");
          return (
            <Link key={meal.id} href="/food" className="flex w-full shrink-0 snap-center flex-col gap-0.5">
              <span className={`text-[10px] ${mirror.muted}`}>
                {meal.tag} · {meal.type}
                {meal.type === "외식" && meal.reservation_time
                  ? ` · ${meal.reservation_time}`
                  : ""}
              </span>
              <span className={`truncate text-[14px] font-medium ${mirror.primary}`}>
                {meal.main_menu}
              </span>
              {(sidesText || meal.participants.length > 0) && (
                <div className="flex items-center gap-2">
                  {sidesText && (
                    <span className={`min-w-0 flex-1 truncate text-[11px] ${mirror.muted}`}>
                      + {sidesText}
                    </span>
                  )}
                  {meal.participants.length > 0 && (
                    <div className={`ml-auto flex shrink-0 ${AVATAR_STACK_OVERLAP}`}>
                      {meal.participants.slice(0, 4).map((p) => (
                        <Avatar
                          key={p.user_id}
                          name={p.display_name}
                          color={p.avatar_color}
                          textColor={p.avatar_text_color}
                          imageUrl={p.avatar_image_url}
                          size={AVATAR_SIZE.mirror}
                        />
                      ))}
                    </div>
                  )}
                </div>
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
