"use client";

import { useState } from "react";
import { youtubeThumbnailUrl } from "@/lib/youtube";
import type { Meal } from "@/types";

/** 끼니 카드 썸네일 해상 규칙(공용) — image_url(촬영/앨범) → 유튜브 썸네일(video_id) → 기본
 * 이모지 순으로 우선순위를 매긴다. 리스트(`MealCard`)/상세(`MealDetail`)/홈 "오늘 뭐먹지"
 * (`MealSummaryCard`)가 전부 이 컴포넌트를 통해 같은 규칙을 쓴다 — 크기·모양(정사각/배너)만
 * 호출부가 `className`으로 다르게 준다. 유튜브 썸네일이 로드 실패하면(영상 삭제 등) 이모지로
 * 폴백한다. */
export function MealThumbnail({
  meal,
  className,
  roundedClassName = "rounded-xl",
  emojiClassName = "text-lg",
}: {
  meal: Pick<Meal, "image_url" | "video_id" | "emoji" | "color" | "main_menu">;
  /** 크기 지정용 — 예: "h-10 w-10"(정사각 리스트), "h-48 w-full"(상세 배너) */
  className: string;
  roundedClassName?: string;
  emojiClassName?: string;
}) {
  const [videoThumbFailed, setVideoThumbFailed] = useState(false);

  const videoThumbSrc =
    meal.video_id && !videoThumbFailed ? youtubeThumbnailUrl(meal.video_id) : null;
  const src = meal.image_url ?? videoThumbSrc;

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${roundedClassName} ${className} ${emojiClassName}`}
      style={{ backgroundColor: meal.color }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={meal.main_menu}
          className={`h-full w-full object-cover ${roundedClassName}`}
          onError={() => {
            if (meal.video_id) setVideoThumbFailed(true);
          }}
        />
      ) : (
        meal.emoji
      )}
    </div>
  );
}
