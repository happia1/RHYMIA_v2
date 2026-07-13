"use client";

import { useState, useTransition } from "react";
import { IconDice5, IconLadder } from "@tabler/icons-react";
import { RouletteBoard } from "@/components/ui/RouletteBoard";
import { LadderGame } from "@/components/ui/LadderGame";
import { createSchedule } from "@/app/(main)/schedule/actions";
import { mirror } from "@/lib/homeTheme";

type Mode = "roulette" | "ladder";

/** 선택한 날짜에 일정이 없을 때 달력 아래에 보여주는 "오늘 뭐하지" 활동 추천.
 * 나이/취미 데이터가 아직 없어 진짜 개인화는 못 하고, 정적 큐레이션 풀 안에서
 * 날짜 시드로 고른 추천 하나 + 룰렛/사다리타기로 다시 골라보는 재미 요소를 제공한다. */
export function ActivitySuggestionSection({
  workspaceId,
  selectedDate,
  suggestion,
  candidatePool,
}: {
  workspaceId: string;
  selectedDate: string;
  suggestion: string;
  candidatePool: string[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("roulette");
  const [isPending, startTransition] = useTransition();

  const registerActivity = (activity: string) => {
    startTransition(() => {
      createSchedule(workspaceId, {
        title: activity,
        date_start: selectedDate,
        target_members: [],
        is_shared: true,
        is_important: false,
        is_all_day: true,
      });
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border-light pt-4">
      {/* 식탁 탭 "오늘의 제안"(SuggestionSection.tsx)과 동일한 톤 — 존재감을 낮게 유지 */}
      <p className={`text-[11px] font-medium ${mirror.muted}`}>
        오늘은 이런 건 어때요: {suggestion}
      </p>

      <button
        onClick={() => setPickerOpen((v) => !v)}
        className="self-start text-[11px] font-medium text-honey"
      >
        {pickerOpen ? "접기" : "다른 추천 골라보기"}
      </button>

      {pickerOpen && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("roulette")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                mode === "roulette" ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              <IconDice5 size={15} />
              룰렛
            </button>
            <button
              onClick={() => setMode("ladder")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                mode === "ladder" ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              <IconLadder size={15} />
              사다리타기
            </button>
          </div>

          {mode === "roulette" ? (
            <RouletteBoard
              pool={candidatePool}
              onSelect={registerActivity}
              isPending={isPending}
              actionLabel="오늘 일정으로 등록"
            />
          ) : (
            <LadderGame
              candidates={candidatePool}
              onSelect={registerActivity}
              isPending={isPending}
              actionLabel="오늘 일정으로 등록"
            />
          )}
        </div>
      )}
    </div>
  );
}
