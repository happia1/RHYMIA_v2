"use client";

import { useEffect, useState } from "react";
import { IconPin, IconPlus } from "@tabler/icons-react";
import { SectionExpand } from "@/components/ui/SectionExpand";
import { NoticeDetailSheet } from "@/components/board/NoticeDetailSheet";
import { NoticeDetailContent } from "@/components/board/NoticeDetailContent";
import { AddPostSheet } from "@/components/board/AddPostSheet";
import { formatPostTimestamp } from "@/lib/date";
import { mirror } from "@/lib/homeTheme";
import { pickDeterministic, seededRange } from "@/lib/randomPick";
import { useDeviceLayout } from "@/lib/useDeviceLayout";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment } from "@/types";

const POSTS_PREVIEW_COUNT = 5;
// 태블릿 스티커 장식 자리 — 지금은 이모지 풀에서 스티커 id로 결정론적 선택.
// TODO(P2): 커스텀 에셋 피커(사용자가 직접 아이콘/이미지를 고르는 UI)로 교체.
const STICKER_DECORATIONS = ["📌", "✨", "🌷", "⭐", "🍀", "🎈"];

// 스티커는 배경이 항상 밝은 파스텔이라, 테마와 무관하게 항상 어두운 고정색 텍스트를 쓴다.
const STICKER_TEXT_COLOR = "#3A3520";
// 모서리 접힘 효과용 그림자색 — 각 배경색을 15%쯤 어둡게 고정 매핑(테마 토큰과 무관, 종이 질감 표현이라 테마와 별개).
const STICKER_FOLD_COLORS: Record<string, string> = {
  "#FFF9C4": "#D9D4A7",
  "#FFE0E0": "#D9BEBE",
  "#E1F5EE": "#BFD0CA",
  "#E3E8FF": "#C1C5D9",
  "#F3E1FF": "#CFBFD9",
};
const STICKER_FOLD_SIZE = 14;

/** 파스텔·손글씨 쪽지 카드 — 모바일 가로 스크롤과 태블릿 코르크보드(랜덤 틸트·그림자·
 * 장식 이모지) 양쪽이 그대로 공유한다. tilt/decoration을 안 넘기면 기존 모바일 모습 그대로. */
function StickerCard({
  notice,
  authorName,
  tilt,
  decoration,
  onClick,
}: {
  notice: Notice;
  authorName: string;
  tilt?: number;
  decoration?: string;
  onClick: () => void;
}) {
  return (
    <div
      className="flex w-28 shrink-0 flex-col gap-1"
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <div
        onClick={onClick}
        className="relative flex h-36 w-28 cursor-pointer flex-col p-2.5 text-left"
        style={{
          backgroundColor: notice.color,
          boxShadow: decoration ? "0 4px 10px rgba(0,0,0,0.18)" : undefined,
        }}
      >
        {decoration && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-2.5 left-1/2 text-[19px]"
            style={{ transform: `translateX(-50%) rotate(${tilt ? -tilt : 0}deg)` }}
          >
            {decoration}
          </span>
        )}
        <span className="truncate text-[11px] opacity-60" style={{ color: STICKER_TEXT_COLOR }}>
          {formatPostTimestamp(notice.created_at)}
        </span>
        {notice.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={notice.image_url} alt="" className="mt-1 h-10 w-full shrink-0 object-cover" />
        )}
        <span
          className="mt-1 line-clamp-3 flex-1 whitespace-pre-wrap font-handwriting text-[19px] leading-snug"
          style={{ color: STICKER_TEXT_COLOR }}
        >
          {notice.content}
        </span>
        {/* 쪽지처럼 끝에 남기는 서명 — "- 엄마" 식 */}
        <span className="truncate self-end text-[12px] opacity-70" style={{ color: STICKER_TEXT_COLOR }}>
          - {authorName}
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
              STICKER_FOLD_COLORS[notice.color] ?? "rgba(0,0,0,0.15)"
            } transparent`,
          }}
        />
      </div>
    </div>
  );
}

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
  const { layout } = useDeviceLayout();
  const [detail, setDetail] = useState<Notice | null>(null);
  const [addingSticky, setAddingSticky] = useState(false);
  const [addingPost, setAddingPost] = useState(false);
  // 태블릿 메모/공지사항 우측 패널에 표시할 선택된 글 — 목록(posts)이 바뀌어도(작성/삭제)
  // 계속 유효한 항목을 가리키도록 동기화한다.
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const stickers = notices.filter((n) => n.type === "sticky");
  // 고정(is_pinned)이 최우선 — 같으면 notices 원래 순서(작성일 최신순)를 그대로 유지한다
  // (정렬 안정성에 의존). 공지(notice) 타입은 폐지되어 메모로 통합됨(supabase/merge_notice_into_memo.sql).
  const posts = notices
    .filter((n) => n.type !== "sticky")
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  const authorOf = (userId: string | null) =>
    (userId && membersById[userId]) || null;

  useEffect(() => {
    if (posts.length === 0) {
      setSelectedPostId(null);
      return;
    }
    if (!posts.some((p) => p.id === selectedPostId)) setSelectedPostId(posts[0].id);
    // posts 원소가 갱신될 때마다(고정 토글 등) 재확인하되, 매번 첫 항목으로 되돌리지는
    // 않도록 selectedPostId 자체는 의존성에서 뺀다(위 조건으로 이미 충분히 처리됨).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;

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
          <span className={`truncate text-[16px] font-medium ${n.is_pinned ? "text-honey" : "text-ink"}`}>
            {n.title}
          </span>
        )}
        <div className="flex items-center justify-between gap-2">
          <p
            className={`min-w-0 flex-1 truncate text-[13px] ${
              n.is_pinned && !n.title ? "text-honey" : "text-[var(--text-muted)]"
            }`}
          >
            {n.content}
          </p>
          <div className="flex shrink-0 items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
            <span className="font-medium">{authorOf(n.created_by)?.display_name ?? "가족"}</span>
            <span>· {formatPostTimestamp(n.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* 모바일 — 변경 없음 */}
      {layout === "mobile" && (
      <div className="flex flex-col gap-1.5">
        <section className="flex flex-col gap-label-gap">
          <span className={mirror.label}>하고싶은 말</span>
          {stickers.length === 0 && (
            <p className="text-[16px] text-[var(--text-muted)]">
              전하고 싶은 말을 쪽지로 남겨보세요!
            </p>
          )}
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
            {stickers.map((s) => (
              <StickerCard
                key={s.id}
                notice={s}
                authorName={authorOf(s.created_by)?.display_name ?? "가족"}
                onClick={() => setDetail(s)}
              />
            ))}
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
            <span className={mirror.label}>메모/공지사항</span>
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
              <p className="text-[16px] text-[var(--text-muted)]">등록된 글이 없어요</p>
            )}
            <SectionExpand items={posts} pageSize={POSTS_PREVIEW_COUNT} renderItem={renderPost} />
          </div>
        </section>
      </div>
      )}

      {/* 태블릿(가로/세로) — 1) 상단 쪽지: 스티커 id 시드 기반 -3~3도 랜덤 틸트(리렌더돼도
          고정), 그림자, 장식 이모지. 2) 하단 메모/공지사항 2단: 좌측 제목 리스트(고정은
          📌+상단 정렬, 선택 하이라이트) / 우측 본문 즉시 표시(팝업 없이 NoticeDetailContent
          그대로 재사용 — 수정 모드도 이 패널 안에서 인라인으로 전환됨). */}
      {layout !== "mobile" && (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-label-gap">
          <div className="flex items-center justify-between">
            <span className={mirror.label}>하고싶은 말</span>
            <button
              onClick={() => setAddingSticky(true)}
              aria-label="하고싶은 말 작성"
              className={`flex h-11 w-11 items-center justify-center ${mirror.muted}`}
            >
              <IconPlus size={18} />
            </button>
          </div>
          {stickers.length === 0 && (
            <p className="text-[16px] text-[var(--text-muted)]">
              전하고 싶은 말을 쪽지로 남겨보세요!
            </p>
          )}
          <div className="flex flex-wrap gap-5 pt-2">
            {stickers.map((s) => (
              <StickerCard
                key={s.id}
                notice={s}
                authorName={authorOf(s.created_by)?.display_name ?? "가족"}
                tilt={seededRange(s.id, -3, 3)}
                decoration={pickDeterministic(STICKER_DECORATIONS, s.id)}
                onClick={() => setDetail(s)}
              />
            ))}
          </div>
        </section>

        <div className="h-px w-full bg-border-light" />

        <section className="flex min-h-0 flex-1 flex-col gap-label-gap">
          <span className={mirror.label}>메모/공지사항</span>
          {posts.length === 0 ? (
            <p className="text-[16px] text-[var(--text-muted)]">등록된 글이 없어요</p>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-[3fr_7fr] gap-5">
              <div className="scrollbar-hide flex flex-col overflow-y-auto">
                {posts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPostId(p.id)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-2 text-left text-[16px] ${
                      p.id === selectedPostId
                        ? "bg-honey/10 font-medium text-honey"
                        : "text-ink"
                    }`}
                  >
                    {p.is_pinned && <IconPin size={12} className="shrink-0 text-honey" />}
                    <span className="min-w-0 flex-1 truncate">{p.title || p.content}</span>
                  </button>
                ))}
              </div>
              <div className="min-h-0 overflow-y-auto rounded-2xl border border-border-light p-4">
                {selectedPost && (
                  <NoticeDetailContent
                    key={selectedPost.id}
                    notice={selectedPost}
                    onClose={() => setSelectedPostId(null)}
                    currentUserId={currentUserId}
                    membersById={membersById}
                    commentsByNotice={commentsByNotice}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      )}

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

