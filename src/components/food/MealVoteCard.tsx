"use client";

import { useTransition } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { castMealVoteBallot, closeMealVote, deleteMealVote, createMeal } from "@/app/(main)/food/actions";
import { currentMealTag } from "@/lib/mealUtils";
import type { MealVote } from "@/types";

export function MealVoteCard({
  vote,
  workspaceId,
  currentUserId,
}: {
  vote: MealVote;
  workspaceId: string;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const ballots = vote.meal_vote_ballot ?? [];
  const tally = vote.candidates.map((_, i) => ballots.filter((b) => b.candidate_index === i).length);
  const myPick = ballots.find((b) => b.user_id === currentUserId)?.candidate_index ?? null;
  const winnerIndex = tally.reduce((best, count, i) => (count > tally[best] ? i : best), 0);

  const cast = (index: number) => startTransition(() => castMealVoteBallot(vote.id, index));
  const close = () => startTransition(() => closeMealVote(vote.id));
  const dismiss = () => startTransition(() => deleteMealVote(vote.id));

  const registerWinner = () => {
    startTransition(async () => {
      await createMeal(workspaceId, {
        date: vote.date,
        tag: currentMealTag(),
        type: "집밥",
        main_menu: vote.candidates[winnerIndex],
        sides: [],
        place: null,
        reservation_time: null,
        memo: null,
      });
    });
  };

  if (vote.is_closed) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border-light p-3">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-honey">투표 결과</span>
          <button onClick={dismiss} aria-label="닫기">
            <IconX size={14} className="text-[var(--text-muted)]" />
          </button>
        </div>
        <span className="text-[19px] font-medium text-ink">{vote.candidates[winnerIndex]}</span>
        <button
          onClick={registerWinner}
          disabled={isPending}
          className="flex h-10 items-center justify-center gap-1 rounded-xl bg-honey text-[16px] font-medium text-white disabled:opacity-50"
        >
          <IconCheck size={14} /> 이 메뉴로 등록
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border-light p-3">
      <span className="text-[14px] font-medium text-[var(--text-muted)]">가족 투표 진행 중</span>
      {vote.candidates.map((candidate, i) => (
        <button
          key={i}
          onClick={() => cast(i)}
          disabled={isPending}
          className={`flex items-center justify-between rounded-xl px-3 py-2 text-[16px] disabled:opacity-50 ${
            myPick === i ? "bg-ink text-cream" : "bg-cream text-ink"
          }`}
        >
          <span>{candidate}</span>
          <span className="text-[13px] opacity-70">{tally[i]}표</span>
        </button>
      ))}
      <button onClick={close} className="self-end text-[13px] font-medium text-[var(--text-muted)]">
        마감하고 결과보기
      </button>
    </div>
  );
}
