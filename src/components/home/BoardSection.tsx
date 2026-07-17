"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { SectionExpand } from "@/components/ui/SectionExpand";
import { NoticeDetailSheet } from "@/components/board/NoticeDetailSheet";
import { AddPostSheet } from "@/components/board/AddPostSheet";
import { formatPostTimestamp } from "@/lib/date";
import { mirror } from "@/lib/homeTheme";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment } from "@/types";

const POSTS_PREVIEW_COUNT = 5;

// 스티커는 배경이 항상 밝은 파스텔이라, 테마와 무관하게 항상 어두운 고정색 텍스트를 쓴다.
const STICKER_TEXT_COLOR = "#3A3520";
// 모서리 접힘 효과용 그림자색 — 각 배경색을 15%쯤 어둡게 고정 매핑(라이트/다크 무관, 종이 질감 표현이라 테마와 별개).
const STICKER_FOLD_COLORS: Record<string, string> = {
  "#FFF9C4": "#D9D4A7",
  "#FFE0E0": "#D9BEBE",
  "#E1F5EE": "#BFD0CA",
  "#E3E8FF": "#C1C5D9",
  "#F3E1FF": "#CFBFD9",
};
const STICKER_FOLD_SIZE = 14;

export function BoardSection({
  workspaceId,
  notices,
  currentUserId,
  membersById,
  commentsByNotice,
}: {
  workspaceId: string;
  notices: Notice[];
  currentUserId: string;
  membersById: Record<string, WorkspaceMemberInfo>;
  commentsByNotice: Record<string, NoticeComment[]>;
}) {
  const [detail, setDetail] = useState<Notice | null>(null);
  const [addingSticky, setAddingSticky] = useState(false);
  const [addingPost, setAddingPost] = useState(false);

  const stickers = notices.filter((n) => n.type === "sticky");
  // 고정(is_pinned)이 최우선 — 같으면 notices 원래 순서(작성일 최신순)를 그대로 유지한다
  // (정렬 안정성에 의존). 공지(notice) 타입은 폐지되어 메모로 통합됨(supabase/merge_notice_into_memo.sql).
  const posts = notices
    .filter((n) => n.type !== "sticky")
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  const authorOf = (userId: string | null) =>
    (userId && membersById[userId]) || null;

  const renderPost = (n: Notice, i: number) => (
    <div
      key={n.id}
      onClick={() => setDetail(n)}
      className={`flex cursor-pointer items-center gap-2.5 py-1 text-left ${
        i > 0 ? "border-t border-border-light" : ""
      }`}
    >
      {n.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={n.image_url} alt="" className="h-10 w-10 shrink-0 rounded-sm object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {n.title && (
          <span className={`truncate text-[13px] font-medium ${n.is_pinned ? "text-honey" : "text-ink"}`}>
            {n.title}
          </span>
        )}
        <div className="flex items-center justify-between gap-2">
          <p
            className={`min-w-0 flex-1 truncate text-[11px] ${
              n.is_pinned && !n.title ? "text-honey" : "text-[var(--text-muted)]"
            }`}
          >
            {n.content}
          </p>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="font-medium">{authorOf(n.created_by)?.display_name ?? "가족"}</span>
            <span>· {formatPostTimestamp(n.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <section className="flex flex-col gap-label-gap">
        <span className={mirror.label}>하고싶은 말</span>
        {stickers.length === 0 && (
          <p className="text-[13px] text-[var(--text-muted)]">
            전하고 싶은 말을 쪽지로 남겨보세요!
          </p>
        )}
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
          {stickers.map((s) => {
            const author = authorOf(s.created_by);
            return (
              <div key={s.id} className="flex w-28 shrink-0 flex-col gap-1">
                <div
                  onClick={() => setDetail(s)}
                  className="relative flex h-36 w-28 cursor-pointer flex-col p-2.5 text-left"
                  style={{ backgroundColor: s.color }}
                >
                  <span
                    className="truncate text-[9px] opacity-60"
                    style={{ color: STICKER_TEXT_COLOR }}
                  >
                    {formatPostTimestamp(s.created_at)}
                  </span>
                  {s.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image_url}
                      alt=""
                      className="mt-1 h-10 w-full shrink-0 object-cover"
                    />
                  )}
                  <span
                    className="mt-1 line-clamp-3 flex-1 whitespace-pre-wrap font-handwriting text-[16px] leading-snug"
                    style={{ color: STICKER_TEXT_COLOR }}
                  >
                    {s.content}
                  </span>
                  {/* 쪽지처럼 끝에 남기는 서명 — "- 엄마" 식 */}
                  <span
                    className="truncate self-end text-[10px] opacity-70"
                    style={{ color: STICKER_TEXT_COLOR }}
                  >
                    - {author?.display_name ?? "가족"}
                  </span>
                  {/* 오른쪽 아래 모서리 접힘 효과 */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 right-0"
                    style={{
                      width: 0,
                      height: 0,
                      borderStyle: "solid",
                      borderWidth: `0 0 ${STICKER_FOLD_SIZE}px ${STICKER_FOLD_SIZE}px`,
                      borderColor: `transparent transparent ${
                        STICKER_FOLD_COLORS[s.color] ?? "rgba(0,0,0,0.15)"
                      } transparent`,
                    }}
                  />
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setAddingSticky(true)}
            aria-label="하고싶은 말 작성"
            className="flex h-36 w-28 shrink-0 items-center justify-center border border-dashed border-border-light text-[var(--text-muted)]"
          >
            <IconPlus size={20} />
          </button>
        </div>
      </section>

      <div className="h-px w-full bg-border-light" />

      <section className="flex flex-col gap-label-gap">
        <div className="flex items-center justify-between">
          <span className={mirror.label}>메모</span>
          <button
            onClick={() => setAddingPost(true)}
            aria-label="메모 작성"
            className={`flex h-11 w-11 items-center justify-center ${mirror.muted}`}
          >
            <IconPlus size={18} />
          </button>
        </div>
        <div className="flex flex-col">
          {posts.length === 0 && (
            <p className="text-[13px] text-[var(--text-muted)]">등록된 글이 없어요</p>
          )}
          <SectionExpand items={posts} pageSize={POSTS_PREVIEW_COUNT} renderItem={renderPost} />
        </div>
      </section>

      <NoticeDetailSheet
        notice={detail}
        onClose={() => setDetail(null)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        membersById={membersById}
        commentsByNotice={commentsByNotice}
      />

      <AddPostSheet
        open={addingSticky || addingPost}
        onClose={() => {
          setAddingSticky(false);
          setAddingPost(false);
        }}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        fixedType={addingSticky ? "sticky" : undefined}
        initialType={addingPost ? "memo" : undefined}
      />
    </div>
  );
}

