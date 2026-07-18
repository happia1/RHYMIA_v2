"use client";

import { useEffect, useState, useTransition } from "react";
import { IconPin } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FullScreenSheet } from "@/components/ui/FullScreenSheet";
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

/** 스티커/메모 상세 슬라이드 팝업 — 게시판 탭(BoardSection)과 홈(하고싶은 말 스티커, 고정
 * 메모)이 완전히 동일하게 재사용하는 공용 컴포넌트. 수정(스티커는 AddPostSheet 수정 모드로,
 * 메모는 이 안에서 제목/내용 인라인 편집)·삭제(작성자 본인만, 우상단 SheetHeaderAction)·
 * 댓글(메모 전용, 스티커는 원래도 댓글 없음)까지 게시판과 똑같이 동작한다. 어느 화면에서
 * 열든 닫으면 그 화면(게시판이면 게시판, 홈이면 홈)에 그대로 남는다 — 페이지 이동 없음. */
export function NoticeDetailSheet({
  notice,
  onClose,
  workspaceId,
  currentUserId,
  membersById,
  commentsByNotice = {},
}: {
  notice: Notice | null;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  membersById: Record<string, WorkspaceMemberInfo>;
  /** 메모(비스티커) 상세에서만 쓰인다 — 스티커 전용 호출부(홈 "하고싶은 말")는 생략 가능. */
  commentsByNotice?: Record<string, NoticeComment[]>;
}) {
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isPending, startTransition] = useTransition();
  // 스티커는 부분 높이 BottomSheet, 메모/공지사항은 전체화면 FullScreenSheet(요구사항 9) —
  // notice는 닫힐 때 곧장 null이 되므로, 닫힘 애니메이션이 끝날 때까지 어느 컨테이너였는지
  // 별도로 기억해둔다(그러지 않으면 닫히는 도중 컨테이너 타입 자체가 바뀌어 리마운트되며
  // 트랜지션이 끊긴다).
  const [lastType, setLastType] = useState<Notice["type"] | null>(notice?.type ?? null);
  useEffect(() => {
    if (notice) setLastType(notice.type);
  }, [notice]);

  const authorOf = (userId: string | null) => (userId && membersById[userId]) || null;

  // 상세를 열 때마다(대상이 바뀔 때 포함) 수정/삭제 확인 상태를 초기화한다.
  useEffect(() => {
    setIsEditingDetail(false);
    setDeleteConfirmOpen(false);
    setCommentDraft("");
    if (notice) {
      setEditTitle(notice.title ?? "");
      setEditContent(notice.content);
    }
  }, [notice]);

  const handleComment = () => {
    const value = commentDraft.trim();
    if (!value || !notice) return;
    setCommentDraft("");
    startTransition(() => addNoticeComment(notice.id, value));
  };

  // 스티커는 색상/사진까지 편집해야 해서 이 시트 안에서 인라인으로 다루지 않고, 기존에
  // 색상·사진 편집을 전부 갖춘 AddPostSheet(수정 모드)로 넘긴다 — 논스티키(메모)만 이
  // 시트 안에서 제목/내용을 바로 편집.
  const handleStartEdit = () => {
    if (!notice) return;
    if (notice.type === "sticky") {
      setEditingNotice(notice);
      onClose();
    } else {
      setIsEditingDetail(true);
    }
  };

  const handleSaveDetailEdit = () => {
    if (!notice || !editContent.trim()) return;
    startTransition(async () => {
      const result = await updateNotice(notice.id, {
        title: editTitle,
        content: editContent,
        isPinned: notice.is_pinned,
      });
      if (!result.ok) return;
      onClose();
    });
  };

  const handleConfirmDelete = () => {
    if (!notice) return;
    startTransition(async () => {
      const result = await deleteNotice(notice.id);
      if (!result.ok) return;
      onClose();
    });
  };

  const Container = lastType === "sticky" ? BottomSheet : FullScreenSheet;

  return (
    <>
      <Container open={!!notice} onClose={onClose}>
        {notice && (
          <div className="flex flex-col gap-3">
            <SheetHeader title={notice.type === "sticky" ? "" : notice.title ?? ""}>
              {!deleteConfirmOpen && !isEditingDetail && notice.created_by === currentUserId && (
                <>
                  <SheetHeaderAction label="수정" onClick={handleStartEdit} />
                  <SheetHeaderAction
                    label="삭제"
                    tone="terra"
                    onClick={() => setDeleteConfirmOpen(true)}
                  />
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
                <p className="text-[13px] text-ink">정말 삭제하시겠어요?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirmOpen(false)}
                    className="flex-1 rounded-xl bg-cream py-2.5 text-[13px] font-medium text-stone"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isPending}
                    className="flex flex-1 items-center justify-center rounded-xl bg-terra py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
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
                  className="h-11 rounded-xl px-3 text-[14px]"
                />
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  className="rounded-xl p-3 text-[14px]"
                />
                <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <span className="font-medium">
                    {authorOf(notice.created_by)?.display_name ?? "가족"}
                  </span>
                  <span>· {formatPostTimestamp(notice.created_at)}</span>
                </div>
              </>
            ) : (
              <>
                {notice.type !== "sticky" && notice.is_pinned && (
                  <div className="flex items-center gap-1 text-[10px] font-medium text-honey">
                    <IconPin size={12} />
                    고정
                  </div>
                )}
                {notice.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={notice.image_url}
                    alt=""
                    className="max-h-56 w-full rounded-xl object-cover"
                  />
                )}
                <p
                  className={`whitespace-pre-wrap text-ink ${
                    notice.type === "sticky" ? "font-handwriting text-[14px]" : "text-[13px]"
                  }`}
                >
                  {notice.content}
                </p>

                {notice.type === "sticky" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      {authorOf(notice.created_by)?.display_name ?? "가족"}
                    </span>
                    {daysLeft(notice.expire_at) !== null && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        D-{Math.max(daysLeft(notice.expire_at)!, 0)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <span className="font-medium">
                      {authorOf(notice.created_by)?.display_name ?? "가족"}
                    </span>
                    <span>· {formatPostTimestamp(notice.created_at)}</span>
                  </div>
                )}
              </>
            )}

            {notice.type !== "sticky" && !isEditingDetail && !deleteConfirmOpen && (
              <div className="mt-2 flex flex-col gap-3 border-t border-border-light pt-3">
                <span className="text-[12px] font-medium text-stone">댓글</span>
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
                        <span className="text-[12px] font-medium text-ink">
                          {commenter?.display_name ?? "가족"}
                        </span>
                        <span className="whitespace-pre-wrap text-[13px] text-ink">{c.content}</span>
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
            )}
          </div>
        )}
      </Container>

      <AddPostSheet
        open={!!editingNotice}
        onClose={() => setEditingNotice(null)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        existingNotice={editingNotice}
      />
    </>
  );
}
