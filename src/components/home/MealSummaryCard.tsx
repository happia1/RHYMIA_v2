import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { TagChip } from "@/components/ui/TagChip";
import type { Meal } from "@/types";

const TYPE_COLOR: Record<string, string> = {
  집밥: "#5BAD7F",
  외식: "#E8A04A",
  배달: "#3D7EAA",
};

export interface MealSummaryParticipant {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
}

export function MealSummaryCard({
  meal,
  participants,
}: {
  meal: (Meal & { time_label?: string }) | null;
  participants: MealSummaryParticipant[];
}) {
  return (
    <Link
      href="/food"
      className="flex items-center justify-between rounded-2xl border border-border-light bg-white p-4"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-stone">오늘 뭐먹지?</span>
        </div>

        {meal ? (
          <>
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
            {participants.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-2">
                  {participants.slice(0, 4).map((p) => (
                    <Avatar
                      key={p.user_id}
                      name={p.display_name}
                      color={p.avatar_color}
                      textColor={p.avatar_text_color}
                      size={24}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-stone">{participants.length}명 참여</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-[15px] text-stone">등록된 끼니가 없어요</p>
        )}
      </div>

      <IconChevronRight size={20} className="shrink-0 text-stone" />
    </Link>
  );
}
