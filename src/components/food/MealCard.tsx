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

const TYPE_COLOR: Record<string, string> = {
  집밥: "#5BAD7F",
  외식: "#E8A04A",
  배달: "#3D7EAA",
};

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
      className="flex cursor-pointer gap-3 rounded-2xl border border-border-light bg-white p-3"
    >
      <div
        className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-3xl"
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            startTransition(() => toggleMealLike(meal.id, !liked));
          }}
          className="absolute -right-1 -top-1"
          aria-label="좋아요"
        >
          {liked ? (
            <IconHeartFilled size={18} className="text-rose" />
          ) : (
            <IconHeart size={18} className="text-white drop-shadow" />
          )}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-stone">{meal.tag}</span>
          <span
            className="text-[10px] font-medium"
            style={{ color: TYPE_COLOR[meal.type] }}
          >
            {meal.type}
          </span>
        </div>
        <p className="truncate text-[15px] font-medium text-ink">{meal.main_menu}</p>
        {meal.sides.length > 0 && (
          <p className="truncate text-[12px] text-stone">{meal.sides.join(", ")}</p>
        )}
        {meal.type === "외식" && meal.place && (
          <p className="truncate text-[12px] text-stone">
            {meal.place}
            {meal.reservation_time ? ` · ${meal.reservation_time}` : ""}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between">
          <div className="flex -space-x-2">
            {participants.map((p) => (
              <Avatar
                key={p.user_id}
                name={p.display_name}
                color={p.avatar_color}
                textColor={p.avatar_text_color}
                imageUrl={p.avatar_image_url}
                size={AVATAR_SIZE.comment}
              />
            ))}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <CheckToggle
              checked={myParticipation === true}
              onChange={() =>
                startTransition(() =>
                  toggleMealParticipation(meal.id, myParticipation)
                )
              }
              size={22}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
