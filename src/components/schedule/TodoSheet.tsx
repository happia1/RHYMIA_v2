"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { Input, Textarea } from "@/components/ui/Input";
import { createTodo } from "@/app/(main)/schedule/actions";
import { toDateStr } from "@/lib/date";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";

const COLORS = ["#E8A04A", "#3D7EAA", "#5BAD7F", "#D96B5A", "#9B8EC4", "#E8416A"];

type QuickPick = "today" | "tomorrow" | "next_week" | "custom";

function quickPickDate(pick: QuickPick): string {
  const d = new Date();
  if (pick === "tomorrow") d.setDate(d.getDate() + 1);
  if (pick === "next_week") d.setDate(d.getDate() + 7);
  return toDateStr(d);
}

export function TodoSheet({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [quickPick, setQuickPick] = useState<QuickPick>("today");
  const [customDate, setCustomDate] = useState(toDateStr(new Date()));
  const [description, setDescription] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [repeatType, setRepeatType] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setQuickPick("today");
    setCustomDate(toDateStr(new Date()));
    setDescription("");
    setNotifyEnabled(false);
    setRepeatType(null);
    setTag(null);
    setColor(COLORS[0]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    const result = await createTodo(workspaceId, {
      title,
      due_date: quickPick === "custom" ? customDate : quickPickDate(quickPick),
      description: description || null,
      notify_enabled: notifyEnabled,
      repeat_type: repeatType,
      tag,
      color,
    });
    setIsSubmitting(false);

    if (result.ok) {
      showToast("할 일이 등록되었습니다.");
      reset();
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">할 일 등록</h2>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할 일 제목"
          className="h-11 rounded-xl px-3 text-[14px]"
        />

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">마감일</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "today", label: "오늘" },
                { value: "tomorrow", label: "내일" },
                { value: "next_week", label: "다음 주" },
                { value: "custom", label: "직접 선택" },
              ] as { value: QuickPick; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuickPick(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                  quickPick === opt.value ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {quickPick === "custom" && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-11 rounded-xl px-3 text-[13px]"
            />
          )}
        </div>

        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          rows={2}
          className="rounded-xl p-3 text-[13px]"
        />

        <label className="flex items-center justify-between text-[13px] text-ink">
          알림
          <input
            type="checkbox"
            checked={notifyEnabled}
            onChange={(e) => setNotifyEnabled(e.target.checked)}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">반복</span>
          <div className="flex flex-wrap gap-2">
            {[
              { value: null, label: "없음" },
              { value: "daily", label: "매일" },
              { value: "weekly", label: "매주" },
              { value: "monthly", label: "매월" },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setRepeatType(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                  repeatType === opt.value ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">태그 (선택)</span>
          <div className="flex flex-wrap gap-2">
            {KEYWORD_GROUPS.map((g) => (
              <button
                key={g.main}
                onClick={() => setTag(tag === g.main ? null : g.main)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                style={{
                  color: g.color,
                  backgroundColor: tag === g.main ? `${g.color}33` : `${g.color}14`,
                  border: tag === g.main ? `1px solid ${g.color}` : "1px solid transparent",
                }}
              >
                {g.main}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">색상</span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                className="h-8 w-8 rounded-full"
                style={{
                  backgroundColor: c,
                  outline: color === c ? "2px solid #1A1A18" : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream"
        >
          등록하기
        </button>
      </div>
    </BottomSheet>
  );
}
