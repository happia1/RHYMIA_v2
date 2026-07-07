"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";
import { TagChip } from "@/components/ui/TagChip";
import type { Meal } from "@/types";

const TYPE_COLOR: Record<string, string> = {
  집밥: "#5BAD7F",
  외식: "#E8A04A",
  배달: "#3D7EAA",
};

export function MealSummaryCard({
  meals,
}: {
  meals: (Meal & { time_label?: string })[];
}) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (meals.length === 0) {
    return (
      <Link
        href="/food"
        className="flex items-center justify-between rounded-2xl border border-border-light bg-white p-4"
      >
        <p className="text-[15px] text-stone">등록된 끼니가 없어요</p>
        <IconChevronRight size={20} className="shrink-0 text-stone" />
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto"
      >
        {meals.map((meal) => (
          <Link
            key={meal.id}
            href="/food"
            className="flex w-full shrink-0 snap-center items-center justify-between rounded-2xl border border-border-light bg-white p-4"
          >
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <TagChip label={meal.tag} color="#888780" />
                <TagChip label={meal.type} color={TYPE_COLOR[meal.type]} />
              </div>
              <p className="truncate text-[17px] font-medium text-ink">
                {meal.emoji} {meal.main_menu}
              </p>
              {meal.type === "외식" && meal.place && (
                <p className="truncate text-[13px] text-stone">
                  {meal.place}
                  {meal.reservation_time ? ` · ${meal.reservation_time}` : ""}
                </p>
              )}
            </div>

            <IconChevronRight size={20} className="shrink-0 text-stone" />
          </Link>
        ))}
      </div>

      {meals.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {meals.map((meal, i) => (
            <span
              key={meal.id}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-ink" : "bg-border-light"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
