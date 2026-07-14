"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SheetHeader, SheetHeaderAction } from "@/components/ui/SheetHeader";
import { useToast } from "@/components/ui/Toast";
import { Input, Textarea } from "@/components/ui/Input";
import { createTodo, updateTodo, deleteTodo } from "@/app/(main)/schedule/actions";
import { toDateStr } from "@/lib/date";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";
import type { Todo } from "@/types";

const COLORS = ["#E8A04A", "#3D7EAA", "#5BAD7F", "#D96B5A", "#9B8EC4", "#E8416A"];

type QuickPick = "today" | "tomorrow" | "next_week" | "custom";

function quickPickDate(pick: QuickPick): string {
  const d = new Date();
  if (pick === "tomorrow") d.setDate(d.getDate() + 1);
  if (pick === "next_week") d.setDate(d.getDate() + 7);
  return toDateStr(d);
}

/** 할 일 등록/수정 겸용 시트 — 월간·주간 뷰에서 할 일 텍스트를 탭하면 `existingTodo`를 넘겨
 * 수정 모드로 열리고(제목·마감일 등 전체 필드 수정 + 삭제), 빈 칸의 "+" 고스트를 탭하면
 * `defaultDueDate`만 넘겨 그 날짜가 프리필된 등록 모드로 연다. 등록 화면의 하단 플로팅
 * + 버튼(AddEventEntry)에서 쓸 땐 둘 다 생략해 기본값(오늘) 그대로 등록 모드. */
export function TodoSheet({
  open,
  onClose,
  workspaceId,
  existingTodo,
  defaultDueDate,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  existingTodo?: Todo | null;
  defaultDueDate?: string | null;
}) {
  const router = useRouter();
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

  // 시트가 열릴 때마다 필드를 다시 채운다 — existingTodo가 있으면 수정 모드로 전체 필드를
  // 프리필하고(마감일이 오늘/내일/다음 주 칩과 정확히 일치하면 그 칩을 선택), 없으면
  // defaultDueDate(빈 칸 "+" 고스트에서 넘어온 날짜)만 반영한 새 등록 폼으로 초기화한다.
  useEffect(() => {
    if (!open) return;
    if (existingTodo) {
      setTitle(existingTodo.title);
      const due = existingTodo.due_date ?? toDateStr(new Date());
      if (due === quickPickDate("today")) setQuickPick("today");
      else if (due === quickPickDate("tomorrow")) setQuickPick("tomorrow");
      else if (due === quickPickDate("next_week")) setQuickPick("next_week");
      else setQuickPick("custom");
      setCustomDate(due);
      setDescription(existingTodo.description ?? "");
      setNotifyEnabled(existingTodo.notify_enabled);
      setRepeatType(existingTodo.repeat_type);
      setTag(existingTodo.tag);
      setColor(existingTodo.color);
    } else {
      reset();
      if (defaultDueDate) {
        setQuickPick("custom");
        setCustomDate(defaultDueDate);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingTodo, defaultDueDate]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    const input = {
      title,
      due_date: quickPick === "custom" ? customDate : quickPickDate(quickPick),
      description: description || null,
      notify_enabled: notifyEnabled,
      repeat_type: repeatType,
      tag,
      color,
    };
    const result = existingTodo
      ? await updateTodo(existingTodo.id, input)
      : await createTodo(workspaceId, input);
    setIsSubmitting(false);

    if (result.ok) {
      showToast(existingTodo ? "할 일이 수정되었습니다." : "할 일이 등록되었습니다.");
      reset();
      onClose();
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!existingTodo) return;
    setIsSubmitting(true);
    const result = await deleteTodo(existingTodo.id);
    setIsSubmitting(false);
    if (result.ok) {
      showToast("할 일이 삭제되었습니다.");
      onClose();
      router.refresh();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <SheetHeader title={existingTodo ? "할 일 수정" : "할 일 등록"}>
          {existingTodo && (
            <SheetHeaderAction label="삭제" tone="terra" onClick={handleDelete} disabled={isSubmitting} />
          )}
          <SheetHeaderAction
            label={existingTodo ? "저장" : "등록"}
            onClick={handleSubmit}
            disabled={isSubmitting}
          />
        </SheetHeader>

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
      </div>
    </BottomSheet>
  );
}
