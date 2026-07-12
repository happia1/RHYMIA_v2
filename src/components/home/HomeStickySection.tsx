"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconNote } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { SectionLabel } from "@/components/home/SectionLabel";
import { AddPostSheet } from "@/components/home/BoardSection";
import type { Notice } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

const STICKY_PREVIEW_COUNT = 3;

/** "하고싶은 말" 홈 위젯 — 최근 등록순(상위 쿼리가 이미 created_at desc로 내려줌) 상위 3개를
 * "오늘 뭐먹지"(MealSummaryCard)와 같은 스냅 캐러셀로 좌우 슬라이드. 이미지·작성자 모두
 * 왼쪽 정렬(예전엔 이미지가 오른쪽 끝, 작성자가 self-end로 오른쪽 정렬이었음). */
export function HomeStickySection({
  workspaceId,
  currentUserId,
  stickers,
  membersById,
}: {
  workspaceId: string;
  currentUserId: string;
  stickers: Notice[];
  membersById: Record<string, WorkspaceMemberInfo>;
}) {
  const [addingSticker, setAddingSticker] = useState(false);
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const previewStickers = stickers.slice(0, STICKY_PREVIEW_COUNT);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel icon={<IconNote size={14} />} onAdd={() => setAddingSticker(true)} addLabel="하고싶은 말 작성">
        하고싶은 말
      </SectionLabel>
      <div className="pl-section-indent">
        {previewStickers.length === 0 ? (
          <p className={`text-[11px] ${mirror.muted}`}>등록된 하고싶은 말이 없어요</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
            >
              {previewStickers.map((s) => {
                const author = membersById[s.created_by ?? ""];
                return (
                  <Link
                    key={s.id}
                    href="/board"
                    className="flex w-full shrink-0 snap-center flex-col items-start gap-1"
                  >
                    {s.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                    )}
                    <span className={`line-clamp-2 text-[12px] ${mirror.secondary}`}>{s.content}</span>
                    <span className={`text-[9px] ${mirror.muted}`}>
                      {author?.display_name ?? "가족"}
                    </span>
                  </Link>
                );
              })}
            </div>
            {previewStickers.length > 1 && (
              <div className="flex gap-1.5">
                {previewStickers.map((s, i) => (
                  <span
                    key={s.id}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? "w-4 bg-honey" : `w-1.5 ${mirror.hairlineBg}`
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AddPostSheet
        open={addingSticker}
        onClose={() => setAddingSticker(false)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        fixedType="sticky"
      />
    </div>
  );
}
