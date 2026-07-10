"use client";

import { useState, useTransition } from "react";
import { IconCheck, IconDice5, IconTrophy, IconUsers } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { RouletteBoard } from "@/components/ui/RouletteBoard";
import { createMeal, createMealVote } from "@/app/(main)/food/actions";
import { currentMealTag } from "@/lib/mealUtils";
import type { MealVote } from "@/types";

type Mode = "roulette" | "worldcup" | "vote";

const MODES: { value: Mode; label: string; icon: typeof IconDice5 }[] = [
  { value: "roulette", label: "룰렛", icon: IconDice5 },
  { value: "worldcup", label: "이상형 월드컵", icon: IconTrophy },
  { value: "vote", label: "가족 투표", icon: IconUsers },
];

export function MealDecisionSheet({
  open,
  onClose,
  workspaceId,
  selectedDate,
  candidatePool,
  activeVote,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  selectedDate: string;
  candidatePool: string[];
  activeVote: MealVote | null;
}) {
  const [mode, setMode] = useState<Mode>("roulette");
  const [isPending, startTransition] = useTransition();

  const registerMenu = (menu: string) => {
    startTransition(() => {
      createMeal(workspaceId, {
        date: selectedDate,
        tag: currentMealTag(),
        type: "집밥",
        main_menu: menu,
        sides: [],
        place: null,
        reservation_time: null,
        memo: null,
      });
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">대신 골라줘</h2>

        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                mode === m.value ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              <m.icon size={15} />
              {m.label}
            </button>
          ))}
        </div>

        {mode === "roulette" && (
          <RouletteBoard
            pool={candidatePool}
            onSelect={registerMenu}
            isPending={isPending}
            actionLabel="이걸로 등록"
          />
        )}
        {mode === "worldcup" && (
          <WorldCupMode pool={candidatePool} onRegister={registerMenu} isPending={isPending} />
        )}
        {mode === "vote" && (
          <VoteMode
            workspaceId={workspaceId}
            selectedDate={selectedDate}
            candidatePool={candidatePool}
            activeVote={activeVote}
            onClose={onClose}
          />
        )}
      </div>
    </BottomSheet>
  );
}

function WorldCupMode({
  pool,
  onRegister,
  isPending,
}: {
  pool: string[];
  onRegister: (menu: string) => void;
  isPending: boolean;
}) {
  const [round, setRound] = useState<string[]>(pool);
  const [pairIndex, setPairIndex] = useState(0);
  const [nextRound, setNextRound] = useState<string[]>([]);
  const [champion, setChampion] = useState<string | null>(null);

  const roundLabel =
    round.length === 8 ? "8강" : round.length === 4 ? "4강" : round.length === 2 ? "결승" : "";

  const reset = () => {
    setRound(pool);
    setPairIndex(0);
    setNextRound([]);
    setChampion(null);
  };

  const pick = (winner: string) => {
    const updatedNext = [...nextRound, winner];
    if (pairIndex + 2 >= round.length) {
      if (updatedNext.length === 1) {
        setChampion(updatedNext[0]);
      } else {
        setRound(updatedNext);
        setNextRound([]);
        setPairIndex(0);
      }
    } else {
      setNextRound(updatedNext);
      setPairIndex(pairIndex + 2);
    }
  };

  if (champion) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <span className="text-[12px] font-medium text-honey">우승</span>
        <span className="text-[20px] font-medium text-ink">{champion}</span>
        <div className="flex w-full gap-2">
          <button
            onClick={reset}
            className="flex-1 rounded-xl bg-cream py-3 text-[13px] font-medium text-stone"
          >
            다시하기
          </button>
          <button
            onClick={() => onRegister(champion)}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-honey py-3 text-[13px] font-medium text-white disabled:opacity-50"
          >
            <IconCheck size={15} /> 등록
          </button>
        </div>
      </div>
    );
  }

  const a = round[pairIndex];
  const b = round[pairIndex + 1];

  return (
    <div className="flex flex-col gap-3">
      <span className="self-center text-[12px] font-medium text-[var(--text-muted)]">
        {roundLabel}
      </span>
      <div className="flex items-stretch gap-3">
        <button
          onClick={() => pick(a)}
          className="flex h-24 flex-1 items-center justify-center rounded-2xl bg-cream px-2 text-center text-[15px] font-medium text-ink"
        >
          {a}
        </button>
        <span className="self-center text-[12px] text-[var(--text-muted)]">VS</span>
        <button
          onClick={() => pick(b)}
          className="flex h-24 flex-1 items-center justify-center rounded-2xl bg-cream px-2 text-center text-[15px] font-medium text-ink"
        >
          {b}
        </button>
      </div>
    </div>
  );
}

function VoteMode({
  workspaceId,
  selectedDate,
  candidatePool,
  activeVote,
  onClose,
}: {
  workspaceId: string;
  selectedDate: string;
  candidatePool: string[];
  activeVote: MealVote | null;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<string[]>(["", ""]);
  const [isPending, startTransition] = useTransition();

  if (activeVote) {
    return (
      <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">
        이미 진행 중인 투표가 있어요. 식탁 탭에서 확인해주세요.
      </p>
    );
  }

  const updateCandidate = (i: number, value: string) => {
    setCandidates((prev) => prev.map((c, idx) => (idx === i ? value : c)));
  };

  const addCandidate = () => {
    if (candidates.length >= 4) return;
    setCandidates((prev) => [...prev, ""]);
  };

  const removeCandidate = (i: number) => {
    if (candidates.length <= 2) return;
    setCandidates((prev) => prev.filter((_, idx) => idx !== i));
  };

  const fillSuggestion = (menu: string) => {
    const emptyIndex = candidates.findIndex((c) => !c.trim());
    if (emptyIndex === -1) return;
    updateCandidate(emptyIndex, menu);
  };

  const handleStart = () => {
    const valid = candidates.map((c) => c.trim()).filter(Boolean);
    if (valid.length < 2) return;
    startTransition(async () => {
      await createMealVote(workspaceId, selectedDate, valid);
      onClose();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[var(--text-muted)]">후보 2~4개를 등록하면 가족이 식탁 탭에서 투표할 수 있어요</p>
      {candidates.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={c}
            onChange={(e) => updateCandidate(i, e.target.value)}
            placeholder={`후보 ${i + 1}`}
            className="h-10 flex-1 rounded-xl px-3 text-[13px]"
          />
          {candidates.length > 2 && (
            <button
              onClick={() => removeCandidate(i)}
              className="text-[12px] text-stone"
              aria-label="후보 삭제"
            >
              삭제
            </button>
          )}
        </div>
      ))}
      {candidates.length < 4 && (
        <button onClick={addCandidate} className="self-start text-[12px] font-medium text-honey">
          + 후보 추가
        </button>
      )}
      {candidatePool.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {candidatePool.slice(0, 6).map((menu) => (
            <button
              key={menu}
              onClick={() => fillSuggestion(menu)}
              className="text-[12px] font-medium text-[var(--text-muted)]"
            >
              {menu}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={handleStart}
        disabled={isPending}
        className="flex h-11 items-center justify-center rounded-2xl bg-ink text-[14px] font-medium text-cream disabled:opacity-50"
      >
        투표 시작하기
      </button>
    </div>
  );
}
