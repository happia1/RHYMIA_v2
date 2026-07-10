"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { toggleMealLike } from "@/app/(main)/food/actions";
import { toggleMealParticipation } from "@/app/(main)/home/actions";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import type { Meal } from "@/types";

export interface MealCardParticipant {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
}

export function MealCard({
  meal,
  participants,
  liked,
  myParticipation,
}: {
  meal: Meal;
  participants: MealCardParticipant[];
  liked: boolean;
  myParticipation: boolean | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
          <span className="text-[10px] font-medium text-honey">{meal.tag}</span>
          <span className="text-[10px] font-medium text-sage">{meal.type}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[15px] text-[var(--text-primary)]">
            {meal.main_menu}
          </span>
          {meal.sides.length > 0 && (
            <span className="truncate text-[12px] text-[var(--text-secondary)]">
              {meal.sides.join(", ")}
            </span>
          )}
        </div>
        {meal.type === "외식" && meal.place && (
          <p className="truncate text-[12px] text-[var(--text-secondary)]">
            {meal.place}
            {meal.reservation_time ? ` · ${meal.reservation_time}` : ""}
          </p>
        )}
        {participants.length > 0 && (
          <div className="flex -space-x-1.5">
            {participants.map((p) => (
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

      <div className="flex shrink-0 flex-col items-end gap-2.5 pt-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            startTransition(() => toggleMealLike(meal.id, !liked));
          }}
          aria-label="좋아요"
        >
          {liked ? (
            <IconHeartFilled size={18} className="text-rose" />
          ) : (
            <IconHeart size={18} className="text-[var(--text-muted)]" />
          )}
        </button>
        <div onClick={(e) => e.stopPropagation()}>
          <CheckToggle
            checked={myParticipation === true}
            onChange={() =>
              startTransition(() => toggleMealParticipation(meal.id, myParticipation))
            }
            size={22}
          />
        </div>
      </div>
    </div>
  );
}
