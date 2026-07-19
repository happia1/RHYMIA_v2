"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { IconArrowLeft, IconMapPin, IconBrandYoutube, IconLink } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { Input } from "@/components/ui/Input";
import { addMealComment, recalculateMealNutrition } from "@/app/(main)/food/actions";
import { useToast } from "@/components/ui/Toast";
import { toggleMealParticipation } from "@/app/(main)/home/actions";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube";
import { MealThumbnail } from "@/components/food/MealThumbnail";
import type { Meal, MealComment } from "@/types";

interface MemberInfo {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
}

export function MealDetail({
  meal,
  members,
  participation,
  comments,
  currentUserId,
  nutritionEnabled = true,
}: {
  meal: Meal;
  members: MemberInfo[];
  participation: { user_id: string; status: boolean | null }[];
  comments: MealComment[];
  currentUserId: string;
  nutritionEnabled?: boolean;
}) {
  const { showToast } = useToast();
  const [commentDraft, setCommentDraft] = useState("");
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRecalculating, startRecalculate] = useTransition();

  const handleRecalculateNutrition = () => {
    startRecalculate(async () => {
      const result = await recalculateMealNutrition(meal.id);
      if (!result.ok) showToast(result.message);
    });
  };

  const author = members.find((m) => m.user_id === meal.author_id);
  const myParticipation =
    participation.find((p) => p.user_id === currentUserId)?.status ?? null;
  const checkedInMembers = participation
    .filter((p) => p.status === true)
    .map((p) => members.find((m) => m.user_id === p.user_id))
    .filter((m): m is MemberInfo => Boolean(m));

  const findMember = (userId: string) => members.find((m) => m.user_id === userId);

  const handleComment = () => {
    const value = commentDraft.trim();
    if (!value) return;
    setCommentDraft("");
    startTransition(() => addMealComment(meal.id, value));
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream pb-8">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/food" aria-label="뒤로가기">
          <IconArrowLeft size={22} className="text-ink" />
        </Link>
        <h1 className="truncate text-[18px] font-medium text-ink">{meal.main_menu}</h1>
        {meal.author_id === currentUserId ? (
          <Link href={`/food/${meal.id}/edit`} className="text-[16px] text-ocean">
            수정
          </Link>
        ) : (
          <div className="w-[22px]" />
        )}
      </header>

      <div className="flex flex-col gap-5 px-4">
        <MealThumbnail
          meal={meal}
          className="h-48 w-full"
          roundedClassName="rounded-2xl"
          emojiClassName="text-6xl"
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-honey">{meal.tag}</span>
            <span className="text-[13px] font-medium text-sage">{meal.type}</span>
          </div>
          <p className="text-[23px] font-medium text-ink">{meal.main_menu}</p>
          {meal.sides.length > 0 && (
            <p className="text-[16px] text-stone">{meal.sides.join(", ")}</p>
          )}
        </div>

        {meal.type === "외식" && meal.place && (
          <a
            href={`https://map.kakao.com/link/search/${encodeURIComponent(meal.place)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[16px] text-ink"
          >
            <IconMapPin size={18} className="text-honey" />
            {meal.place}
            {meal.reservation_time ? ` · ${meal.reservation_time}` : ""}
          </a>
        )}

        {meal.memo && (
          <p className="whitespace-pre-wrap text-[12px] text-ink">{meal.memo}</p>
        )}

        {meal.video_id && (
          <a
            href={youtubeWatchUrl(meal.video_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            {thumbnailError ? (
              <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl bg-cream">
                <IconBrandYoutube size={22} className="text-[var(--text-muted)]" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={youtubeThumbnailUrl(meal.video_id)}
                alt=""
                className="h-16 w-28 shrink-0 rounded-xl object-cover"
                onError={() => setThumbnailError(true)}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[16px] text-ink">
              {meal.recipe_title ?? "레시피 영상 보기"}
            </span>
          </a>
        )}

        {meal.recipe_url && (
          <a
            href={meal.recipe_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl bg-cream">
              <IconLink size={22} className="text-[var(--text-muted)]" />
            </div>
            <span className="min-w-0 flex-1 truncate text-[16px] text-ink">레시피 블로그 보기</span>
          </a>
        )}

        {nutritionEnabled &&
          (meal.kcal_min != null &&
          meal.kcal_max != null &&
          meal.macro_carb != null &&
          meal.macro_protein != null &&
          meal.macro_fat != null ? (
            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-medium text-stone">영양 정보 (추정)</span>
              <p className="text-[18px] text-ink">
                약 {meal.kcal_min}~{meal.kcal_max}kcal
              </p>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border-light">
                <span className="h-full bg-honey" style={{ width: `${meal.macro_carb}%` }} />
                <span className="h-full bg-sage" style={{ width: `${meal.macro_protein}%` }} />
                <span className="h-full bg-terra" style={{ width: `${meal.macro_fat}%` }} />
              </div>
              <div className="flex items-center gap-3 text-[12px] text-stone">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-honey" />
                  탄수화물 {meal.macro_carb}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  단백질 {meal.macro_protein}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-terra" />
                  지방 {meal.macro_fat}%
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-muted)]">메뉴 기준 추정치예요</p>
            </div>
          ) : (
            // 등록 시점에 백그라운드 추정이 실패했거나(에이전트 서버 다운 등) 마이그레이션
            // 이전에 등록된 끼니 — 여기서 1회 재추정을 직접 트리거할 수 있게 한다.
            <button
              onClick={handleRecalculateNutrition}
              disabled={isRecalculating}
              className="self-start text-[14px] font-medium text-honey disabled:opacity-50"
            >
              {isRecalculating ? "계산 중..." : "영양 정보 다시 계산"}
            </button>
          ))}

        {author && (
          <div className="flex items-center gap-2">
            <Avatar
              name={author.display_name}
              color={author.avatar_color}
              textColor={author.avatar_text_color}
              imageUrl={author.avatar_image_url}
              size={AVATAR_SIZE.comment}
            />
            <span className="text-[14px] text-stone">{author.display_name}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border-light pt-4">
          <div className="flex -space-x-2">
            {checkedInMembers.map((m) => (
              <Avatar
                key={m.user_id}
                name={m.display_name}
                color={m.avatar_color}
                textColor={m.avatar_text_color}
                imageUrl={m.avatar_image_url}
                size={AVATAR_SIZE.card}
              />
            ))}
            {checkedInMembers.length === 0 && (
              <span className="text-[16px] text-stone">참여자가 없어요</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <CheckToggle
              checked={myParticipation === true}
              onChange={() =>
                startTransition(() =>
                  toggleMealParticipation(meal.id, myParticipation)
                )
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-[14px] font-medium text-stone">댓글</span>
          {comments.map((c) => {
            const m = findMember(c.user_id);
            return (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar
                  name={m?.display_name ?? "가족"}
                  color={m?.avatar_color}
                  textColor={m?.avatar_text_color}
                  imageUrl={m?.avatar_image_url}
                  size={AVATAR_SIZE.comment}
                />
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-ink">
                    {m?.display_name ?? "가족"}
                  </span>
                  <span className="text-[16px] text-ink">{c.content}</span>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <Input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleComment()}
              placeholder="댓글을 남겨보세요"
              className="h-11 flex-1 rounded-xl px-3 text-[16px]"
            />
            <button
              onClick={handleComment}
              disabled={isPending}
              className="rounded-xl bg-ink px-4 py-2.5 text-[16px] font-medium text-cream"
            >
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
