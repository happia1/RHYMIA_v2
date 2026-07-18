"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { MealThumbnail } from "@/components/food/MealThumbnail";
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

/** 홈은 "오늘 등록된 것만" 보여주는 상태판 — 끼니가 없으면 아무것도 표시하지 않는다.
 * 메뉴를 고르는 경험(빈 상태/추천/게임)은 식탁 탭이 전담한다. 참여자 아바타는 존재감을
 * 낮추기 위해 표시하지 않는다(반찬 텍스트만). */
export function MealSummaryCard({ meals }: { meals: MealSummaryItem[] }) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollToIndex = (i: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  if (meals.length === 0) {
    return null;
  }

  const hasMultiple = meals.length > 1;

  return (
    <div className="flex flex-col gap-label-gap">
      <div className="relative">
        {hasMultiple && (
          <button
            onClick={() => scrollToIndex((index - 1 + meals.length) % meals.length)}
            aria-label="이전 메뉴"
            className="absolute inset-y-0 left-0 z-10 flex w-8 items-center justify-start text-stone"
          >
            <IconChevronLeft size={16} />
          </button>
        )}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
        >
          {meals.map((meal) => {
            const sidesText = meal.sides.join(", ");
            return (
              <Link
                key={meal.id}
                href="/food"
                className={`flex w-full shrink-0 snap-start items-center gap-2.5 ${
                  hasMultiple ? "px-8" : ""
                }`}
              >
                <MealThumbnail meal={meal} className="h-10 w-10" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`text-[11px] ${mirror.muted}`}>
                    {meal.tag} · {meal.type}
                    {meal.type === "외식" && meal.reservation_time
                      ? ` · ${meal.reservation_time}`
                      : ""}
                  </span>
                  <span className={`truncate text-[14px] font-medium ${mirror.primary}`}>
                    {meal.main_menu}
                  </span>
                  {sidesText && (
                    <span className={`truncate text-[12px] ${mirror.muted}`}>+ {sidesText}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {hasMultiple && (
          <button
            onClick={() => scrollToIndex((index + 1) % meals.length)}
            aria-label="다음 메뉴"
            className="absolute inset-y-0 right-0 z-10 flex w-8 items-center justify-end text-stone"
          >
            <IconChevronRight size={16} />
          </button>
        )}
      </div>

      {hasMultiple && (
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
