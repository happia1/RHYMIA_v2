"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconPin } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { addNotice, deleteNotice } from "@/app/(main)/home/actions";
import type { Notice, NoticeType } from "@/types";

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
}: {
  workspaceId: string;
  notices: Notice[];
  currentUserId: string;
}) {
  const [detail, setDetail] = useState<Notice | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  const stickers = notices.filter((n) => n.type === "sticky");
  const posts = notices
    .filter((n) => n.type !== "sticky")
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-stone">게시판</span>
        <button onClick={() => setAdding(true)} aria-label="새글 등록">
          <IconPlus size={18} className="text-stone" />
        </button>
      </div>

      {stickers.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {stickers.map((s) => {
            const left = daysLeft(s.expire_at);
            return (
              <button
                key={s.id}
                onClick={() => setDetail(s)}
                className="relative flex h-24 w-24 shrink-0 flex-col rounded-2xl p-2.5 text-left"
                style={{ backgroundColor: s.color }}
              >
                {left !== null && (
                  <span className="absolute right-2 top-2 text-[10px] font-medium text-ink/50">
                    D-{Math.max(left, 0)}
                  </span>
                )}
                <span className="mt-3 line-clamp-4 text-[12px] text-ink">
                  {s.content}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {posts.length === 0 && stickers.length === 0 && (
          <p className="text-[13px] text-stone">등록된 글이 없어요</p>
        )}
        {posts.map((n) => (
          <button
            key={n.id}
            onClick={() => setDetail(n)}
            className="flex items-center gap-2 text-left"
          >
            {n.is_pinned && <IconPin size={14} className="shrink-0 text-terra" />}
            <span className="truncate text-[14px] font-medium text-ink">
              {n.title ?? n.content}
            </span>
          </button>
        ))}
      </div>

      <BottomSheet open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <div className="flex flex-col gap-3">
            {detail.title && (
              <h2 className="text-[17px] font-medium text-ink">{detail.title}</h2>
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
                className="mt-2 self-start text-[13px] text-terra"
              >
                삭제하기
              </button>
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
