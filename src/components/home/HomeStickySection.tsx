"use client";

import { useRef, useState } from "react";
import { IconNote } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { SectionLabel } from "@/components/home/SectionLabel";
import { AddPostSheet } from "@/components/board/AddPostSheet";
import { NoticeDetailSheet } from "@/components/board/NoticeDetailSheet";
import type { Notice } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

const STICKY_PREVIEW_COUNT = 3;

/** "하고싶은 말" 홈 위젯 — 최근 등록순(상위 쿼리가 이미 created_at desc로 내려줌) 상위 3개를
 * "오늘 뭐먹지"(MealSummaryCard)와 같은 스냅 캐러셀로 좌우 슬라이드. 이미지·작성자 모두
 * 왼쪽 정렬(예전엔 이미지가 오른쪽 끝, 작성자가 self-end로 오른쪽 정렬이었음). 스티커 탭 시
 * 게시판 탭으로 이동하지 않고 홈 위에서 바로 상세 팝업(NoticeDetailSheet, 게시판과 동일
 * 컴포넌트) — 닫으면 홈에 그대로 남는다. */
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
  const [detailNotice, setDetailNotice] = useState<Notice | null>(null);
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
          <p className={`text-[12px] ${mirror.muted}`}>등록된 하고싶은 말이 없어요</p>
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
                  <button
                    key={s.id}
                    onClick={() => setDetailNotice(s)}
                    className="flex w-full shrink-0 snap-center flex-col items-start gap-1 text-left"
                  >
                    {s.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image_url} alt="" className="h-10 w-full rounded object-cover" />
                    )}
                    <span className={`line-clamp-2 text-[13px] ${mirror.secondary}`}>{s.content}</span>
                    <span className={`text-[11px] ${mirror.muted}`}>
                      {author?.display_name ?? "가족"}
                    </span>
                  </button>
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

      <NoticeDetailSheet
        notice={detailNotice}
        onClose={() => setDetailNotice(null)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        membersById={membersById}
      />
    </div>
  );
}
