"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { toggleMealParticipation } from "@/app/(main)/home/actions";
import { deleteMeal } from "@/app/(main)/food/actions";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { mealKcalMedian } from "@/lib/mealUtils";
import type { Meal } from "@/types";

export interface MealCardParticipant {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
}

const MAX_STACKED_AVATARS = 4;
// 아바타 지름(AVATAR_SIZE.mealCard=15px)의 1/5만 보이게 겹치는 음수 마진 — 15 * 4/5 = 12px
const AVATAR_STACK_OVERLAP = "-space-x-[12px]";

export function MealCard({
  meal,
  participants,
  myParticipation,
  nutritionEnabled = true,
}: {
  meal: Meal;
  participants: MealCardParticipant[];
  myParticipation: boolean | null;
  /** 설정 "영양 정보 표시" 토글 — 꺼져 있으면 kcal 라인을 아예 렌더하지 않는다 */
  nutritionEnabled?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const visibleParticipants = participants.slice(0, MAX_STACKED_AVATARS);
  const overflowCount = participants.length - visibleParticipants.length;
  const kcalMedian = nutritionEnabled ? mealKcalMedian(meal) : null;

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteMeal(meal.id);
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      setDeleteConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <div
      onClick={() => router.push(`/food/${meal.id}`)}
      className="flex cursor-pointer items-start gap-3 py-3"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: meal.color }}
      >
        {meal.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meal.image_url}
            alt={meal.main_menu}
            className="h-full w-full rounded-xl object-cover"
          />
        ) : (
          meal.emoji
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-medium text-honey">{meal.tag}</span>
          <span className="text-[9px] font-medium text-sage">{meal.type}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] text-[var(--text-primary)]">
            {meal.main_menu}
          </span>
          {meal.sides.length > 0 && (
            <span className="truncate text-[11px] text-[var(--text-secondary)]">
              {meal.sides.join(", ")}
            </span>
          )}
        </div>
        {meal.type === "외식" && meal.place && (
          <p className="truncate text-[11px] text-[var(--text-secondary)]">
            {meal.place}
            {meal.reservation_time ? ` · ${meal.reservation_time}` : ""}
          </p>
        )}
        {kcalMedian != null && (
          <p className="text-[11px] text-[var(--text-secondary)]">약 {kcalMedian}kcal</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch pt-0.5">
        <div className="flex items-center gap-2">
          {visibleParticipants.length > 0 && (
            <div className={`flex ${AVATAR_STACK_OVERLAP}`}>
              {visibleParticipants.map((p) => (
                <Avatar
                  key={p.user_id}
                  name={p.display_name}
                  color={p.avatar_color}
                  textColor={p.avatar_text_color}
                  imageUrl={p.avatar_image_url}
                  size={AVATAR_SIZE.mealCard}
                />
              ))}
              {overflowCount > 0 && (
                <span
                  className="flex items-center justify-center rounded-full bg-border-light text-[8px] font-medium text-stone"
                  style={{ width: AVATAR_SIZE.mealCard, height: AVATAR_SIZE.mealCard }}
                >
                  +{overflowCount}
                </span>
              )}
            </div>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <CheckToggle
              checked={myParticipation === true}
              onChange={() =>
                startTransition(() => toggleMealParticipation(meal.id, myParticipation))
              }
              size={18}
            />
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmOpen(true);
          }}
          aria-label="끼니 삭제"
          className="text-[var(--text-muted)]"
        >
          <IconX size={14} />
        </button>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <BottomSheet open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink">&quot;{meal.main_menu}&quot; 끼니를 삭제하시겠습니까?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 rounded-xl bg-cream py-2.5 text-[13px] font-medium text-stone"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex flex-1 items-center justify-center rounded-xl bg-terra py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
              >
                삭제하기
              </button>
            </div>
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}
