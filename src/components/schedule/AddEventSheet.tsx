"use client";

import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createSchedule } from "@/app/(main)/schedule/actions";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";

interface MemberOption {
  user_id: string;
  display_name: string;
}

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
  const [title, setTitle] = useState("");
  const [dateStart, setDateStart] = useState(defaultDate);
  const [isRange, setIsRange] = useState(false);
  const [dateEnd, setDateEnd] = useState(defaultDate);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [isShared, setIsShared] = useState(true);
  const [keywordMain, setKeywordMain] = useState<string | null>(null);
  const [keywordSub, setKeywordSub] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [supplies, setSupplies] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [isGrocery, setIsGrocery] = useState(false);
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  const activeGroup = KEYWORD_GROUPS.find((g) => g.main === keywordMain);

  const toggleTarget = (userId: string) => {
    setTargets((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    startTransition(() => {
      createSchedule(workspaceId, {
        title,
        date_start: dateStart,
        date_end: isRange ? dateEnd : null,
        time_start: timeStart || null,
        time_end: timeEnd || null,
        target_members: targets,
        is_shared: isShared,
        keyword_main: keywordMain,
        keyword_sub: keywordSub,
        is_important: isImportant,
        memo: memo || null,
        supplies: supplies || null,
        is_grocery: isGrocery,
        place: isGrocery ? place || null : null,
        amount: isGrocery && amount ? Number(amount) : null,
        receipt_image_url: isGrocery ? receiptUrl || null : null,
      });
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">일정 등록</h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="h-11 rounded-xl border border-border-light px-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
        />

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-border-light px-3 text-[13px] text-ink focus:outline-none"
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
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink focus:outline-none"
            />
          )}
          <div className="flex gap-2">
            <input
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-border-light px-3 text-[13px] text-ink focus:outline-none"
            />
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-border-light px-3 text-[13px] text-ink focus:outline-none"
            />
          </div>
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
                key={m.user_id}
                onClick={() => toggleTarget(m.user_id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  targets.includes(m.user_id) ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {m.display_name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { value: true, label: "공유" },
            { value: false, label: "프라이빗" },
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

        <input
          value={supplies}
          onChange={(e) => setSupplies(e.target.value)}
          placeholder="준비물 (선택)"
          className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={2}
          className="rounded-xl border border-border-light p-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
        />

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
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="장소"
              className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="지출 금액"
              className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
            />
            <input
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="영수증 이미지 URL (선택)"
              className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream"
        >
          등록하기
        </button>
      </div>
    </BottomSheet>
  );
}
