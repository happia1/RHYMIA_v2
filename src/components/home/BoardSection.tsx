"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  IconPlus,
  IconCamera,
  IconPhotoScan,
  IconLoader2,
  IconX,
  IconPencil,
  IconPin,
} from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "@/components/ui/Avatar";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { SectionExpand } from "@/components/ui/SectionExpand";
import {
  addNotice,
  updateNotice,
  deleteNotice,
  addNoticeComment,
} from "@/app/(main)/board/actions";
import { formatPostTimestamp } from "@/lib/date";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { mirror } from "@/lib/homeTheme";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromImage } from "@/lib/agentApi";
import { compressImage } from "@/lib/imageCompress";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment, NoticeType } from "@/types";

const POSTS_PREVIEW_COUNT = 4;

const STICKER_COLORS = ["#FFF9C4", "#FFE0E0", "#E1F5EE", "#E3E8FF", "#F3E1FF"];
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

function daysLeft(expireAt: string | null) {
  if (!expireAt) return null;
  const diff = Math.ceil(
    (new Date(expireAt).getTime() - Date.now()) / 86400000
  );
  return diff;
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
  const { showToast } = useToast();
  const [detail, setDetail] = useState<Notice | null>(null);
  const [addingSticky, setAddingSticky] = useState(false);
  const [addingPost, setAddingPost] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isPending, startTransition] = useTransition();

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
      className={`flex cursor-pointer items-center gap-2.5 py-1.5 text-left ${
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

  // 상세 시트를 열 때마다(대상이 바뀔 때 포함) 수정/삭제 확인 상태를 초기화한다.
  useEffect(() => {
    setIsEditingDetail(false);
    setDeleteConfirmOpen(false);
    if (detail) {
      setEditTitle(detail.title ?? "");
      setEditContent(detail.content);
    }
  }, [detail]);

  const handleComment = () => {
    const value = commentDraft.trim();
    if (!value || !detail) return;
    setCommentDraft("");
    startTransition(() => addNoticeComment(detail.id, value));
  };

  const handleSaveDetailEdit = () => {
    if (!detail || !editContent.trim()) return;
    startTransition(async () => {
      const result = await updateNotice(detail.id, {
        title: editTitle,
        content: editContent,
        isPinned: detail.is_pinned,
      });
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      setDetail(null);
    });
  };

  const handleConfirmDelete = () => {
    if (!detail) return;
    startTransition(async () => {
      const result = await deleteNotice(detail.id);
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      setDetail(null);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <section className="flex flex-col gap-label-gap">
        <span className={mirror.label}>하고싶은 말</span>
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
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="truncate text-[9px] opacity-60"
                      style={{ color: STICKER_TEXT_COLOR }}
                    >
                      {formatPostTimestamp(s.created_at)}
                    </span>
                    {s.created_by === currentUserId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNotice(s);
                        }}
                        aria-label="수정"
                        className="shrink-0 opacity-60"
                      >
                        <IconPencil size={12} style={{ color: STICKER_TEXT_COLOR }} />
                      </button>
                    )}
                  </div>
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

      <BottomSheet
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setCommentDraft("");
        }}
      >
        {detail && (
          <div className="flex flex-col gap-3">
            {detail.type !== "sticky" && detail.created_by === currentUserId && !deleteConfirmOpen && (
              <div className="flex justify-end">
                <button
                  onClick={() => setIsEditingDetail((v) => !v)}
                  aria-label="수정"
                  className={isEditingDetail ? "text-honey" : "text-[var(--text-muted)]"}
                >
                  <IconPencil size={16} />
                </button>
              </div>
            )}

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
            ) : detail.type !== "sticky" && isEditingDetail ? (
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
                    {authorOf(detail.created_by)?.display_name ?? "가족"}
                  </span>
                  <span>· {formatPostTimestamp(detail.created_at)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="flex-1 rounded-xl bg-cream py-2.5 text-[13px] font-medium text-terra"
                  >
                    삭제
                  </button>
                  <button
                    onClick={handleSaveDetailEdit}
                    disabled={isPending || !editContent.trim()}
                    className="flex flex-1 items-center justify-center rounded-xl bg-ink py-2.5 text-[13px] font-medium text-cream disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
              </>
            ) : (
              <>
                {detail.type !== "sticky" && detail.is_pinned && (
                  <div className="flex items-center gap-1 text-[10px] font-medium text-honey">
                    <IconPin size={12} />
                    고정
                  </div>
                )}
                {detail.title && (
                  <h2 className="text-[17px] font-medium text-ink">{detail.title}</h2>
                )}
                {detail.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail.image_url}
                    alt=""
                    className="max-h-56 w-full rounded-xl object-cover"
                  />
                )}
                <p
                  className={`whitespace-pre-wrap text-[13px] text-ink ${
                    detail.type === "sticky" ? "font-handwriting text-[16px]" : ""
                  }`}
                >
                  {detail.content}
                </p>

                {detail.type === "sticky" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      {authorOf(detail.created_by)?.display_name ?? "가족"}
                    </span>
                    {daysLeft(detail.expire_at) !== null && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        D-{Math.max(daysLeft(detail.expire_at)!, 0)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <span className="font-medium">
                      {authorOf(detail.created_by)?.display_name ?? "가족"}
                    </span>
                    <span>· {formatPostTimestamp(detail.created_at)}</span>
                  </div>
                )}

                {detail.type === "sticky" && detail.created_by === currentUserId && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteNotice(detail.id);
                        if (!result.ok) {
                          showToast(result.message);
                          return;
                        }
                        setDetail(null);
                      })
                    }
                    disabled={isPending}
                    className="self-start text-[13px] text-terra"
                  >
                    삭제하기
                  </button>
                )}
              </>
            )}

            {detail.type !== "sticky" && !isEditingDetail && !deleteConfirmOpen && (
              <div className="mt-2 flex flex-col gap-3 border-t border-border-light pt-3">
                <span className="text-[12px] font-medium text-stone">댓글</span>
                {(commentsByNotice[detail.id] ?? []).map((c) => {
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
      </BottomSheet>

      <AddPostSheet
        open={addingSticky || addingPost || !!editingNotice}
        onClose={() => {
          setAddingSticky(false);
          setAddingPost(false);
          setEditingNotice(null);
        }}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        fixedType={addingSticky ? "sticky" : undefined}
        initialType={addingPost ? "memo" : undefined}
        existingNotice={editingNotice}
      />
    </div>
  );
}

export function AddPostSheet({
  open,
  onClose,
  workspaceId,
  currentUserId,
  fixedType,
  initialType,
  existingNotice,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  /** 지정하면 타입 선택 UI를 숨기고 이 타입으로 고정 (예: "하고싶은 말" 작성 버튼) */
  fixedType?: NoticeType;
  /** fixedType이 없을 때(메모/공지 작성 버튼) 기본 선택 타입 — 픽커는 항상 메모/공지만 보여줌 */
  initialType?: NoticeType;
  /** 지정하면 수정 모드로 열림 — 기존 내용으로 채우고 저장 시 새로 만들지 않고 updateNotice로 반영 */
  existingNotice?: Notice | null;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<NoticeType>(fixedType ?? initialType ?? "memo");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState(STICKER_COLORS[0]);
  const [expireDays, setExpireDays] = useState(1);
  const [isPinned, setIsPinned] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [isPending, startTransition] = useTransition();

  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // 시트가 열릴 때마다(수정 대상이 바뀔 때 포함) 필드를 다시 채운다 — 시트 자체는
  // 계속 마운트된 채 open만 토글되므로, 최초 마운트 시 useState 초기값만으로는
  // "추가"→"수정"으로 열릴 때 이전 내용이 남는 문제가 생긴다.
  useEffect(() => {
    if (!open) return;
    if (existingNotice) {
      setType(existingNotice.type);
      setTitle(existingNotice.title ?? "");
      setContent(existingNotice.content);
      setColor(existingNotice.color);
      setImageUrl(existingNotice.image_url);
      setIsPinned(existingNotice.is_pinned);
    } else {
      setType(fixedType ?? initialType ?? "memo");
      setTitle("");
      setContent("");
      setColor(STICKER_COLORS[0]);
      setExpireDays(1);
      setIsPinned(false);
      setImageUrl(null);
    }
    setAttachError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingNotice, fixedType, initialType]);

  /** 이미지 삽입 — 스티키(사진 첨부)와 메모/공지(이미지 삽입) 둘 다에서 공용으로 쓰는 업로드 핸들러. */
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAttachError("");
    if (!file.type.startsWith("image/")) {
      setAttachError("이미지 파일만 첨부할 수 있어요.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const supabase = createClient();
      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "png";
      const path = `${currentUserId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("notice-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("notice-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setAttachError(err instanceof Error ? `업로드에 실패했어요: ${err.message}` : "업로드에 실패했어요.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleOcrImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAttachError("");
    if (!file.type.startsWith("image/")) {
      setAttachError("이미지 파일만 첨부할 수 있어요.");
      return;
    }

    setIsExtractingText(true);
    try {
      const dataUrl = await compressImage(file);
      const text = await extractTextFromImage(dataUrl);
      if (text.trim()) {
        setContent((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
      } else {
        setAttachError("이미지에서 텍스트를 찾지 못했어요.");
      }
    } catch (err) {
      setAttachError(
        err instanceof Error && err.message && !err.message.startsWith("agent_http_")
          ? err.message
          : "텍스트 추출에 실패했어요."
      );
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    startTransition(async () => {
      if (existingNotice) {
        const result = await updateNotice(existingNotice.id, {
          type: type !== "sticky" ? type : undefined,
          title: type === "sticky" ? undefined : title,
          content,
          color: type === "sticky" ? color : undefined,
          isPinned: type !== "sticky" ? isPinned : undefined,
          imageUrl,
        });
        if (!result.ok) {
          showToast(result.message);
          return;
        }
      } else {
        await addNotice(workspaceId, {
          type,
          title: type === "sticky" ? undefined : title,
          content,
          color: type === "sticky" ? color : undefined,
          isPinned: type !== "sticky" ? isPinned : undefined,
          expireDays: type === "sticky" ? expireDays : undefined,
          imageUrl,
        });
      }
      onClose();
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {type === "sticky" ? (
          <>
            <div className="flex gap-2">
              {STICKER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full ${
                    color === c ? "ring-2 ring-ink ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자유롭게 적어보세요"
              rows={3}
              className="rounded-xl p-3 text-[14px]"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => imageFileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex items-center gap-1.5 text-[13px] font-medium text-honey disabled:opacity-50"
              >
                {isUploadingImage ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconCamera size={16} />
                )}
                {imageUrl ? "사진 변경" : "사진 첨부"}
              </button>
              {imageUrl && (
                <div className="relative h-10 w-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <button
                    onClick={() => setImageUrl(null)}
                    aria-label="사진 제거"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-cream"
                  >
                    <IconX size={10} />
                  </button>
                </div>
              )}
            </div>
            {!existingNotice && (
              <div className="flex gap-2">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExpireDays(d)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                      expireDays === d ? "bg-ink text-cream" : "bg-cream text-stone"
                    }`}
                  >
                    {d}일
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="h-11 rounded-xl px-3 text-[14px]"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              rows={4}
              className="rounded-xl p-3 text-[14px]"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => imageFileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex items-center gap-1.5 text-[13px] font-medium text-honey disabled:opacity-50"
              >
                {isUploadingImage ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconCamera size={16} />
                )}
                {imageUrl ? "이미지 변경" : "이미지 삽입"}
              </button>
              {imageUrl && (
                <div className="relative h-10 w-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <button
                    onClick={() => setImageUrl(null)}
                    aria-label="이미지 제거"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-cream"
                  >
                    <IconX size={10} />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => ocrFileInputRef.current?.click()}
              disabled={isExtractingText}
              className="flex items-center gap-1.5 self-start text-[13px] font-medium text-honey disabled:opacity-50"
            >
              {isExtractingText ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconPhotoScan size={16} />
              )}
              {isExtractingText ? "텍스트를 읽는 중..." : "사진에서 텍스트 채우기"}
            </button>
            <input
              ref={ocrFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleOcrImageSelected}
            />
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              상단 고정
            </label>
          </>
        )}
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />

        {attachError && <p className="text-[12px] text-terra">{attachError}</p>}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex h-11 items-center justify-center rounded-2xl bg-ink text-[14px] font-medium text-cream"
        >
          {existingNotice ? "저장하기" : "등록하기"}
        </button>
      </div>
    </BottomSheet>
  );
}
