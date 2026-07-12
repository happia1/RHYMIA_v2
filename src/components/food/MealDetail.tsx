"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { IconArrowLeft, IconMapPin, IconBrandYoutube } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { Input } from "@/components/ui/Input";
import { addMealComment } from "@/app/(main)/food/actions";
import { toggleMealParticipation } from "@/app/(main)/home/actions";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube";
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
}: {
  meal: Meal;
  members: MemberInfo[];
  participation: { user_id: string; status: boolean | null }[];
  comments: MealComment[];
  currentUserId: string;
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isPending, startTransition] = useTransition();

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
        <h1 className="truncate text-[15px] font-medium text-ink">{meal.main_menu}</h1>
        {meal.author_id === currentUserId ? (
          <Link href={`/food/${meal.id}/edit`} className="text-[13px] text-ocean">
            수정
          </Link>
        ) : (
          <div className="w-[22px]" />
        )}
      </header>

      <div className="flex flex-col gap-5 px-4">
        <div
          className="relative flex h-48 w-full items-center justify-center rounded-2xl text-6xl"
          style={{ backgroundColor: meal.color }}
        >
          {meal.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meal.image_url}
              alt={meal.main_menu}
              className="h-full w-full rounded-2xl object-cover"
            />
          ) : (
            meal.emoji
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-honey">{meal.tag}</span>
            <span className="text-[11px] font-medium text-sage">{meal.type}</span>
          </div>
          <p className="text-[19px] font-medium text-ink">{meal.main_menu}</p>
          {meal.sides.length > 0 && (
            <p className="text-[13px] text-stone">{meal.sides.join(", ")}</p>
          )}
        </div>

        {meal.type === "외식" && meal.place && (
          <a
            href={`https://map.kakao.com/link/search/${encodeURIComponent(meal.place)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-ink"
          >
            <IconMapPin size={18} className="text-honey" />
            {meal.place}
            {meal.reservation_time ? ` · ${meal.reservation_time}` : ""}
          </a>
        )}

        {meal.memo && <p className="text-[14px] text-ink">{meal.memo}</p>}

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
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
              {meal.recipe_title ?? "레시피 영상 보기"}
            </span>
          </a>
        )}

        {author && (
          <div className="flex items-center gap-2">
            <Avatar
              name={author.display_name}
              color={author.avatar_color}
              textColor={author.avatar_text_color}
              imageUrl={author.avatar_image_url}
              size={AVATAR_SIZE.comment}
            />
            <span className="text-[12px] text-stone">{author.display_name}</span>
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
              <span className="text-[13px] text-stone">참여자가 없어요</span>
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
          <span className="text-[12px] font-medium text-stone">댓글</span>
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
                  <span className="text-[12px] font-medium text-ink">
                    {m?.display_name ?? "가족"}
                  </span>
                  <span className="text-[13px] text-ink">{c.content}</span>
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
              className="h-11 flex-1 rounded-xl px-3 text-[13px]"
            />
            <button
              onClick={handleComment}
              disabled={isPending}
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-medium text-cream"
            >
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
