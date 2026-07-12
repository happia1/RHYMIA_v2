"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { Input, Textarea } from "@/components/ui/Input";
import { PlaceInput } from "@/components/schedule/PlaceInput";
import { createSchedule } from "@/app/(main)/schedule/actions";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";
import type { NotifyOffset, RecurType, RecurCalendar } from "@/types";

interface MemberOption {
  id: string;
  display_name: string;
}

const NOTIFY_OPTIONS: { value: NotifyOffset; label: string }[] = [
  { value: "same_day_morning", label: "당일 오전" },
  { value: "day_before", label: "하루 전" },
  { value: "week_before", label: "일주일 전" },
  { value: "custom", label: "직접 설정" },
];

const RECUR_OPTIONS: { value: RecurType; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "monthly", label: "매월" },
  { value: "yearly", label: "매년" },
];

/** 신규 등록 전용(수정 모드 없음) — 반복 일정 편집 화면은 다음 작업에서 구현 예정.
 * 그때는: 가상 인스턴스(originalId/isVirtual, src/lib/recurrence.ts)를 열면 "원본을
 * 수정합니다" 안내를 보여주고 저장/삭제 모두 originalId로 라우팅해야 함. "이번 회만
 * 수정"(단일 인스턴스 예외 처리)은 P2로 미룸 — recur_until로 원본을 끊고 새 반복을
 * 만드는 우회로만 우선 지원. */
export function AddEventSheet({
  open,
  onClose,
  workspaceId,
  members,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  members: MemberOption[];
  defaultDate: string;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [dateStart, setDateStart] = useState(defaultDate);
  const [isRange, setIsRange] = useState(false);
  const [dateEnd, setDateEnd] = useState(defaultDate);
  const [isAllDay, setIsAllDay] = useState(true);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [isShared, setIsShared] = useState(true);
  const [keywordMain, setKeywordMain] = useState<string | null>(null);
  const [keywordSub, setKeywordSub] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [place, setPlace] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isGrocery, setIsGrocery] = useState(false);
  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notifyOffset, setNotifyOffset] = useState<NotifyOffset | null>(null);
  const [notifyCustomAt, setNotifyCustomAt] = useState("");
  const [recurType, setRecurType] = useState<RecurType>("none");
  const [recurCalendar, setRecurCalendar] = useState<RecurCalendar>("solar");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeGroup = KEYWORD_GROUPS.find((g) => g.main === keywordMain);

  const toggleTarget = (memberId: string) => {
    setTargets((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const reset = () => {
    setTitle("");
    setDateStart(defaultDate);
    setIsRange(false);
    setDateEnd(defaultDate);
    setIsAllDay(true);
    setTimeStart("");
    setTimeEnd("");
    setTargets([]);
    setIsShared(true);
    setKeywordMain(null);
    setKeywordSub(null);
    setMemo("");
    setIsImportant(false);
    setPlace("");
    setImageUrl("");
    setIsGrocery(false);
    setAmount("");
    setReceiptUrl("");
    setNotifyOffset(null);
    setNotifyCustomAt("");
    setRecurType("none");
    setRecurCalendar("solar");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    const result = await createSchedule(workspaceId, {
      title,
      date_start: dateStart,
      date_end: isRange ? dateEnd : null,
      time_start: !isAllDay ? timeStart || null : null,
      time_end: !isAllDay ? timeEnd || null : null,
      target_members: targets,
      is_shared: isShared,
      keyword_main: keywordMain,
      keyword_sub: keywordSub,
      is_important: isImportant,
      memo: memo || null,
      is_grocery: isGrocery,
      place: place || null,
      amount: isGrocery && amount ? Number(amount) : null,
      receipt_image_url: isGrocery ? receiptUrl || null : null,
      is_all_day: isAllDay,
      image_url: imageUrl || null,
      notify_offset: notifyOffset,
      notify_custom_at: notifyOffset === "custom" ? notifyCustomAt || null : null,
      recur_type: recurType,
      recur_calendar: recurType === "yearly" ? recurCalendar : "solar",
    });
    setIsSubmitting(false);

    if (result.ok) {
      showToast("일정이 등록되었습니다.");
      reset();
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">일정 등록</h2>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="h-11 rounded-xl px-3 text-[14px]"
        />

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="h-11 flex-1 rounded-xl px-3 text-[13px]"
            />
            <label className="flex items-center gap-1.5 text-[12px] text-stone">
              <input
                type="checkbox"
                checked={isRange}
                onChange={(e) => setIsRange(e.target.checked)}
              />
              기간
            </label>
          </div>
          {isRange && (
            <Input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="h-11 rounded-xl px-3 text-[13px]"
            />
          )}

          <label className="flex items-center justify-between text-[13px] text-ink">
            종일
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
            />
          </label>

          {!isAllDay && (
            <div className="flex gap-2">
              <Input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="h-11 flex-1 rounded-xl px-3 text-[13px]"
              />
              <Input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="h-11 flex-1 rounded-xl px-3 text-[13px]"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">반복</span>
          <div className="flex gap-2">
            {RECUR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRecurType(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                  recurType === opt.value ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {recurType === "yearly" && (
            <div className="flex gap-2">
              {(
                [
                  ["solar", "양력"],
                  ["lunar", "음력"],
                ] as [RecurCalendar, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setRecurCalendar(value)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                    recurCalendar === value ? "bg-ink text-cream" : "bg-cream text-stone"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">대상</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTargets([])}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                targets.length === 0 ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              가족 전체
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleTarget(m.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  targets.includes(m.id) ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {m.display_name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">공유 대상</span>
          <div className="flex gap-2">
            {[
              { value: true, label: "가족 전체" },
              { value: false, label: "개인" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setIsShared(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                  isShared === opt.value ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">키워드 (선택)</span>
          <div className="flex flex-wrap gap-2">
            {KEYWORD_GROUPS.map((g) => (
              <button
                key={g.main}
                onClick={() => {
                  setKeywordMain(keywordMain === g.main ? null : g.main);
                  setKeywordSub(null);
                }}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                style={{
                  color: g.color,
                  backgroundColor: keywordMain === g.main ? `${g.color}33` : `${g.color}14`,
                  border: keywordMain === g.main ? `1px solid ${g.color}` : "1px solid transparent",
                }}
              >
                {g.main}
              </button>
            ))}
          </div>
          {activeGroup && activeGroup.subs.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-2">
              {activeGroup.subs.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setKeywordSub(keywordSub === sub ? null : sub)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                    keywordSub === sub ? "bg-ink text-cream" : "bg-cream text-stone"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>

        <PlaceInput value={place} onChange={setPlace} />

        <Textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (준비물 등 자유롭게)"
          rows={3}
          className="rounded-xl p-3 text-[13px]"
        />

        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="사진 URL (선택)"
          className="h-11 rounded-xl px-3 text-[13px]"
        />

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">알림</span>
          <div className="flex flex-wrap gap-2">
            {NOTIFY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setNotifyOffset(notifyOffset === opt.value ? null : opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                  notifyOffset === opt.value ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {notifyOffset === "custom" && (
            <Input
              type="datetime-local"
              value={notifyCustomAt}
              onChange={(e) => setNotifyCustomAt(e.target.value)}
              className="h-11 rounded-xl px-3 text-[13px]"
            />
          )}
        </div>

        <label className="flex items-center justify-between text-[13px] text-ink">
          공지(중요)
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(e) => setIsImportant(e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between text-[13px] text-ink">
          장보기 일정
          <input
            type="checkbox"
            checked={isGrocery}
            onChange={(e) => setIsGrocery(e.target.checked)}
          />
        </label>

        {isGrocery && (
          <div className="flex flex-col gap-2">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="지출 금액"
              className="h-11 rounded-xl px-3 text-[13px]"
            />
            <Input
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="영수증 이미지 URL (선택)"
              className="h-11 rounded-xl px-3 text-[13px]"
            />
          </div>
        )}

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
