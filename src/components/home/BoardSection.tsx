"use client";

import { useRef, useState, useTransition } from "react";
import { IconPlus, IconPin, IconNote, IconMessage2, IconCamera, IconLoader2, IconX } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "@/components/ui/Avatar";
import { Input, Textarea } from "@/components/ui/Input";
import { SectionLabel } from "@/components/home/SectionLabel";
import { addNotice, deleteNotice, addNoticeComment } from "@/app/(main)/board/actions";
import { formatPostTimestamp } from "@/lib/date";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromImage } from "@/lib/agentApi";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment, NoticeType } from "@/types";

const POSTS_PREVIEW_COUNT = 3;

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [detail, setDetail] = useState<Notice | null>(null);
  const [adding, setAdding] = useState(false);
  const [postsExpanded, setPostsExpanded] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const stickers = notices.filter((n) => n.type === "sticky");
  const posts = notices
    .filter((n) => n.type !== "sticky")
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
  const visiblePosts = postsExpanded ? posts : posts.slice(0, POSTS_PREVIEW_COUNT);

  const authorOf = (userId: string | null) =>
    (userId && membersById[userId]) || null;

  const handleComment = () => {
    const value = commentDraft.trim();
    if (!value || !detail) return;
    setCommentDraft("");
    startTransition(() => addNoticeComment(detail.id, value));
  };

  return (
    <div className="flex flex-col gap-section">
      <div className="flex items-center justify-end">
        <button onClick={() => setAdding(true)} aria-label="새글 등록">
          <IconPlus size={18} className="text-[var(--text-muted)]" />
        </button>
      </div>

      <section className="flex flex-col gap-label-gap">
        <SectionLabel icon={<IconNote size={14} />}>하고싶은 말</SectionLabel>
        <div className="pl-section-indent">
          {stickers.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">등록된 하고싶은 말이 없어요</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {stickers.map((s) => {
                const left = daysLeft(s.expire_at);
                const author = authorOf(s.created_by);
                return (
                  <div key={s.id} className="flex w-28 shrink-0 flex-col gap-1">
                    <button
                      onClick={() => setDetail(s)}
                      className="relative flex min-h-28 w-28 flex-col p-2.5 text-left"
                      style={{ backgroundColor: s.color }}
                    >
                      <span
                        className="truncate text-[9px] opacity-60"
                        style={{ color: STICKER_TEXT_COLOR }}
                      >
                        {author?.display_name ?? "가족"}
                      </span>
                      {s.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image_url}
                          alt=""
                          className="mt-1 h-12 w-full shrink-0 object-cover"
                        />
                      )}
                      <span
                        className="mt-1 line-clamp-5 whitespace-pre-wrap font-handwriting text-[16px] leading-snug"
                        style={{ color: STICKER_TEXT_COLOR }}
                      >
                        {s.content}
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
                    </button>
                    {left !== null && (
                      <span className="self-end text-[10px] text-[var(--text-muted)]">
                        D-{Math.max(left, 0)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="h-px w-full bg-border-light" />

      <section className="flex flex-col gap-label-gap">
        <SectionLabel icon={<IconMessage2 size={14} />}>메모 · 공지</SectionLabel>
        <div className="flex flex-col pl-section-indent">
          {posts.length === 0 && (
            <p className="text-[13px] text-[var(--text-muted)]">등록된 글이 없어요</p>
          )}
          {visiblePosts.map((n, i) => {
            const author = authorOf(n.created_by);
            return (
              <button
                key={n.id}
                onClick={() => setDetail(n)}
                className={`flex flex-col gap-1 py-3 text-left ${
                  i > 0 ? "border-t border-border-light" : ""
                }`}
              >
                {n.title && (
                  <span className="truncate text-[14px] font-medium text-ink">
                    {n.type === "notice" ? `📌 ${n.title}` : n.title}
                  </span>
                )}
                <p className="line-clamp-2 whitespace-pre-wrap text-[12px] text-ink">{n.content}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  {n.is_pinned && <IconPin size={12} className="shrink-0 text-terra" />}
                  <span className="font-medium">{author?.display_name ?? "가족"}</span>
                  <span>· {formatPostTimestamp(n.created_at)}</span>
                </div>
              </button>
            );
          })}
          {posts.length > POSTS_PREVIEW_COUNT && (
            <button
              onClick={() => setPostsExpanded((v) => !v)}
              className="self-end text-[11px] text-[var(--text-muted)]"
            >
              {postsExpanded ? "접기" : "더보기"}
            </button>
          )}
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
            {detail.title && (
              <h2 className="text-[17px] font-medium text-ink">
                {detail.type === "notice" ? `📌 ${detail.title}` : detail.title}
              </h2>
            )}
            {detail.type === "sticky" && detail.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.image_url} alt="" className="max-h-56 w-full rounded-xl object-cover" />
            )}
            <p
              className={`whitespace-pre-wrap text-[13px] text-ink ${
                detail.type === "sticky" ? "font-handwriting text-[18px]" : ""
              }`}
            >
              {detail.content}
            </p>
            {detail.type !== "sticky" && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <span className="font-medium">
                  {authorOf(detail.created_by)?.display_name ?? "가족"}
                </span>
                <span>· {formatPostTimestamp(detail.created_at)}</span>
              </div>
            )}
            {detail.created_by === currentUserId && (
              <button
                onClick={() =>
                  startTransition(() => {
                    deleteNotice(detail.id);
                    setDetail(null);
                  })
                }
                disabled={isPending}
                className="self-start text-[13px] text-terra"
              >
                삭제하기
              </button>
            )}

            {detail.type !== "sticky" && (
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
        open={adding}
        onClose={() => setAdding(false)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
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
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  /** 지정하면 타입 선택 UI를 숨기고 이 타입으로 고정 (예: 홈의 "하고싶은 말" 섹션 + 버튼) */
  fixedType?: NoticeType;
}) {
  const [type, setType] = useState<NoticeType>(fixedType ?? "sticky");
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

  const stickyFileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setType(fixedType ?? "sticky");
    setTitle("");
    setContent("");
    setColor(STICKER_COLORS[0]);
    setExpireDays(1);
    setIsPinned(false);
    setImageUrl(null);
    setAttachError("");
  };

  const handleStickyImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const dataUrl = await fileToBase64(file);
      const text = await extractTextFromImage(dataUrl);
      if (text.trim()) {
        setContent((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
      } else {
        setAttachError("이미지에서 텍스트를 찾지 못했어요.");
      }
    } catch {
      setAttachError("텍스트 추출에 실패했어요.");
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    startTransition(async () => {
      await addNotice(workspaceId, {
        type,
        title: type === "sticky" ? undefined : title,
        content,
        color: type === "sticky" ? color : undefined,
        isPinned: type !== "sticky" ? isPinned : undefined,
        expireDays: type === "sticky" ? expireDays : undefined,
        imageUrl: type === "sticky" ? imageUrl : undefined,
      });
      reset();
      onClose();
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="flex flex-col gap-4">
        {!fixedType && (
          <div className="flex gap-2">
            {(
              [
                ["sticky", "하고싶은 말"],
                ["memo", "메모"],
                ["notice", "공지"],
              ] as [NoticeType, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setType(value)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                  type === value ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

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
                onClick={() => stickyFileInputRef.current?.click()}
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
              <input
                ref={stickyFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleStickyImageSelected}
              />
            </div>
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
            <button
              onClick={() => ocrFileInputRef.current?.click()}
              disabled={isExtractingText}
              className="flex items-center gap-1.5 self-start text-[13px] font-medium text-honey disabled:opacity-50"
            >
              {isExtractingText ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconCamera size={16} />
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

        {attachError && <p className="text-[12px] text-terra">{attachError}</p>}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex h-11 items-center justify-center rounded-2xl bg-ink text-[14px] font-medium text-cream"
        >
          등록하기
        </button>
      </div>
    </BottomSheet>
  );
}
