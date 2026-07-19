"use client";

import { useEffect, useState, useTransition } from "react";
import { IconPin } from "@tabler/icons-react";
import { SheetHeader, SheetHeaderAction } from "@/components/ui/SheetHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Input, Textarea } from "@/components/ui/Input";
import { formatPostTimestamp } from "@/lib/date";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { updateNotice, deleteNotice, addNoticeComment } from "@/app/(main)/board/actions";
import { AddPostSheet } from "@/components/board/AddPostSheet";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment } from "@/types";

function daysLeft(expireAt: string | null) {
  if (!expireAt) return null;
  return Math.ceil((new Date(expireAt).getTime() - Date.now()) / 86400000);
}

/** 스티커/메모 상세 콘텐츠 — 제목/본문 보기·인라인 편집(메모)·삭제 확인·댓글(메모 전용)까지
 * 전부 담당한다. 모바일(NoticeDetailSheet, 전체화면/부분 슬라이드 팝업)과 태블릿 게시판
 * (메모/공지사항 우측 고정 패널) 양쪽이 이 컴포넌트 하나를 그대로 공유 — 바깥 컨테이너만
 * 다르다("수정 모드도 우측 패널 안에서" 요구사항은 이 컴포넌트가 이미 팝업이든 패널이든
 * 상관없이 내부 상태(isEditingDetail)로 인라인 전환하기 때문에 자동으로 충족됨). 스티커는
 * 색상/사진까지 편집해야 해서 이 안에서 인라인으로 안 다루고, 이미 그 편집을 갖춘
 * AddPostSheet(수정 모드)로 넘긴다(editingSticky). */
export function NoticeDetailContent({
  notice,
  onClose,
  currentUserId,
  membersById,
  commentsByNotice = {},
}: {
  notice: Notice;
  /** 저장/삭제가 끝난 뒤 호출 — 모바일은 팝업을 닫고, 태블릿 패널은 보통 아무 것도 안 해도
   * 된다(부모의 posts 목록이 서버 재검증으로 갱신되면서 자연히 다음 항목이 보이거나 그대로
   * 최신 내용으로 리렌더됨). */
  onClose: () => void;
  currentUserId: string;
  membersById: Record<string, WorkspaceMemberInfo>;
  /** 메모(비스티커) 상세에서만 쓰인다 — 스티커 전용 호출부(홈 "하고싶은 말")는 생략 가능. */
  commentsByNotice?: Record<string, NoticeComment[]>;
}) {
  const [editingSticky, setEditingSticky] = useState<Notice | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const authorOf = (userId: string | null) => (userId && membersById[userId]) || null;

  // 대상(notice)이 바뀔 때마다 수정/삭제 확인 상태를 초기화한다.
  useEffect(() => {
    setIsEditingDetail(false);
    setDeleteConfirmOpen(false);
    setCommentDraft("");
    setEditTitle(notice.title ?? "");
    setEditContent(notice.content);
  }, [notice]);

  const handleComment = () => {
    const value = commentDraft.trim();
    if (!value) return;
    setCommentDraft("");
    startTransition(() => addNoticeComment(notice.id, value));
  };

  const handleStartEdit = () => {
    if (notice.type === "sticky") {
      setEditingSticky(notice);
    } else {
      setIsEditingDetail(true);
    }
  };

  const handleSaveDetailEdit = () => {
    if (!editContent.trim()) return;
    startTransition(async () => {
      const result = await updateNotice(notice.id, {
        title: editTitle,
        content: editContent,
        isPinned: notice.is_pinned,
      });
      if (!result.ok) return;
      setIsEditingDetail(false);
      onClose();
    });
  };

  const handleConfirmDelete = () => {
    startTransition(async () => {
      const result = await deleteNotice(notice.id);
      if (!result.ok) return;
      onClose();
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <SheetHeader title={notice.type === "sticky" ? "" : notice.title ?? ""}>
          {!deleteConfirmOpen && !isEditingDetail && notice.created_by === currentUserId && (
            <>
              <SheetHeaderAction label="수정" onClick={handleStartEdit} />
              <SheetHeaderAction label="삭제" tone="terra" onClick={() => setDeleteConfirmOpen(true)} />
            </>
          )}
          {!deleteConfirmOpen && isEditingDetail && (
            <SheetHeaderAction
              label="저장"
              onClick={handleSaveDetailEdit}
              disabled={isPending || !editContent.trim()}
            />
          )}
        </SheetHeader>

        {deleteConfirmOpen ? (
          <div className="flex flex-col gap-3">
            <p className="text-[16px] text-ink">정말 삭제하시겠어요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 rounded-xl bg-cream py-2.5 text-[16px] font-medium text-stone"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="flex flex-1 items-center justify-center rounded-xl bg-terra py-2.5 text-[16px] font-medium text-white disabled:opacity-50"
              >
                삭제하기
              </button>
            </div>
          </div>
        ) : isEditingDetail ? (
          <>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="제목"
              className="h-11 rounded-xl px-3 text-[17px]"
            />
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="rounded-xl p-3 text-[17px]"
            />
            <div className="flex items-center justify-end gap-1.5 text-[13px] text-[var(--text-muted)]">
              <span className="font-medium">{authorOf(notice.created_by)?.display_name ?? "가족"}</span>
              <span>· {formatPostTimestamp(notice.created_at)}</span>
            </div>
          </>
        ) : (
          <>
            {notice.type !== "sticky" && notice.is_pinned && (
              <div className="flex items-center gap-1 text-[12px] font-medium text-honey">
                <IconPin size={12} />
                고정
              </div>
            )}
            {notice.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={notice.image_url} alt="" className="max-h-56 w-full rounded-xl object-cover" />
            )}
            <p
              className={`whitespace-pre-wrap text-ink ${
                notice.type === "sticky" ? "font-handwriting text-[17px]" : "text-[16px]"
              }`}
            >
              {notice.content}
            </p>

            {notice.type === "sticky" ? (
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--text-muted)]">
                  {authorOf(notice.created_by)?.display_name ?? "가족"}
                </span>
                {daysLeft(notice.expire_at) !== null && (
                  <span className="text-[13px] text-[var(--text-muted)]">
                    D-{Math.max(daysLeft(notice.expire_at)!, 0)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-end gap-1.5 text-[13px] text-[var(--text-muted)]">
                <span className="font-medium">{authorOf(notice.created_by)?.display_name ?? "가족"}</span>
                <span>· {formatPostTimestamp(notice.created_at)}</span>
              </div>
            )}
          </>
        )}

        {notice.type !== "sticky" && !isEditingDetail && !deleteConfirmOpen && (
          <div className="mt-2 flex flex-col gap-3 border-t border-border-light pt-3">
            <span className="text-[14px] font-medium text-stone">댓글</span>
            {(commentsByNotice[notice.id] ?? []).map((c) => {
              const commenter = authorOf(c.user_id);
              return (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar
                    name={commenter?.display_name ?? "가족"}
                    color={commenter?.avatar_color}
                    textColor={commenter?.avatar_text_color}
                    imageUrl={commenter?.avatar_image_url}
                    size={AVATAR_SIZE.comment}
                  />
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium text-ink">
                      {commenter?.display_name ?? "가족"}
                    </span>
                    <span className="whitespace-pre-wrap text-[16px] text-ink">{c.content}</span>
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
        )}
      </div>

      <AddPostSheet
        open={!!editingSticky}
        onClose={() => setEditingSticky(null)}
        workspaceId={notice.workspace_id}
        currentUserId={currentUserId}
        existingNotice={editingSticky}
      />
    </>
  );
}
