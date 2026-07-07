"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconPin } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "@/components/ui/Avatar";
import { addNotice, deleteNotice, addNoticeComment } from "@/app/(main)/board/actions";
import { formatPostTimestamp } from "@/lib/date";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment, NoticeType } from "@/types";

const STICKER_COLORS = ["#FFF9C4", "#FFE0E0", "#E1F5EE", "#E3E8FF", "#F3E1FF"];

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
  const [detail, setDetail] = useState<Notice | null>(null);
  const [adding, setAdding] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const stickers = notices.filter((n) => n.type === "sticky");
  const posts = notices
    .filter((n) => n.type !== "sticky")
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  const authorOf = (userId: string | null) =>
    (userId && membersById[userId]) || null;

  const handleComment = () => {
    const value = commentDraft.trim();
    if (!value || !detail) return;
    setCommentDraft("");
    startTransition(() => addNoticeComment(detail.id, value));
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setAdding(true)} aria-label="새글 등록">
          <IconPlus size={18} className="text-stone" />
        </button>
      </div>

      {stickers.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {stickers.map((s) => {
            const left = daysLeft(s.expire_at);
            const author = authorOf(s.created_by);
            return (
              <div key={s.id} className="flex w-24 shrink-0 flex-col gap-1">
                <button
                  onClick={() => setDetail(s)}
                  className="flex h-24 w-24 flex-col rounded-2xl p-2.5 text-left"
                  style={{ backgroundColor: s.color }}
                >
                  <span className="truncate text-[9px] text-ink/50">
                    {author?.display_name ?? "가족"}
                  </span>
                  <span className="mt-1 line-clamp-3 text-[12px] text-ink">
                    {s.content}
                  </span>
                </button>
                {left !== null && (
                  <span className="self-end text-[10px] text-stone/70">
                    D-{Math.max(left, 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {posts.length === 0 && stickers.length === 0 && (
          <p className="text-[13px] text-stone">등록된 글이 없어요</p>
        )}
        {posts.map((n) => {
          const author = authorOf(n.created_by);
          return (
            <button
              key={n.id}
              onClick={() => setDetail(n)}
              className="flex flex-col gap-1 rounded-xl border border-border-light p-3 text-left"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-stone">
                {n.is_pinned && <IconPin size={12} className="shrink-0 text-terra" />}
                <span className="font-medium">{author?.display_name ?? "가족"}</span>
                <span>· {formatPostTimestamp(n.created_at)}</span>
              </div>
              {n.title && (
                <span className="truncate text-[14px] font-medium text-ink">
                  {n.type === "notice" ? `📌 ${n.title}` : n.title}
                </span>
              )}
              <p className="line-clamp-2 text-[13px] text-ink">{n.content}</p>
            </button>
          );
        })}
      </div>

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
            {detail.type !== "sticky" && (
              <div className="flex items-center gap-1.5 text-[12px] text-stone">
                <span className="font-medium">
                  {authorOf(detail.created_by)?.display_name ?? "가족"}
                </span>
                <span>· {formatPostTimestamp(detail.created_at)}</span>
              </div>
            )}
            <p className="whitespace-pre-wrap text-[14px] text-ink">
              {detail.content}
            </p>
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
                        <span className="text-[13px] text-ink">{c.content}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleComment()}
                    placeholder="댓글을 남겨보세요"
                    className="h-11 flex-1 rounded-xl border border-border-light bg-white px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
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
      />
    </div>
  );
}

function AddPostSheet({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const [type, setType] = useState<NoticeType>("sticky");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState(STICKER_COLORS[0]);
  const [expireDays, setExpireDays] = useState(1);
  const [isPinned, setIsPinned] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setType("sticky");
    setTitle("");
    setContent("");
    setColor(STICKER_COLORS[0]);
    setExpireDays(1);
    setIsPinned(false);
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
        <div className="flex gap-2">
          {(
            [
              ["sticky", "스티커"],
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
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자유롭게 적어보세요"
              rows={3}
              className="rounded-xl border border-border-light p-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
            />
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
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="h-11 rounded-xl border border-border-light px-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              rows={4}
              className="rounded-xl border border-border-light p-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
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
