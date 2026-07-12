"use client";

import { useEffect, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { Input, Textarea } from "@/components/ui/Input";
import { PlaceInput } from "@/components/schedule/PlaceInput";
import { createSchedule, updateSchedule, deleteSchedule } from "@/app/(main)/schedule/actions";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";
import type { ExpandedSchedule } from "@/lib/recurrence";
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

// 공휴일은 이제 키워드가 아니라 src/lib/holidays.ts의 내장 데이터로 달력에 표시되므로
// 신규 등록 키워드 목록에서는 제외한다. 과거에 "공휴일" 키워드로 등록된 일정은 그대로
// 남아있고(마이그레이션 없음), scheduleKeywords.ts의 KEYWORD_GROUPS엔 그 일정들의 점/밴드
// 색상이 계속 정상적으로 나오도록 "공휴일" 항목 자체는 남겨둔다 — 여기서만 걸러낸다.
const REGISTRABLE_KEYWORD_GROUPS = KEYWORD_GROUPS.filter((g) => g.main !== "공휴일");

/** "이번 회만 수정"(단일 인스턴스 예외 처리)은 P2로 미룸 — recur_until로 원본을 끊고
 * 새 반복을 만드는 우회로만 우선 지원.
 *
 * 폼은 기본(제목/날짜/반복/키워드)과 "자세한 설정"(대상/알림/장소/메모/금액/공지 여부/
 * 외부 공유 링크, 기본 접힘)으로 나뉜다 — 대부분의 등록은 기본만으로 끝나고, 나머지는
 * 필요할 때만 펼쳐서 채우는 저빈도 필드로 취급한다. */
export function AddEventSheet({
  open,
  onClose,
  workspaceId,
  members,
  defaultDate,
  prefill,
  existingSchedule,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  members: MemberOption[];
  defaultDate: string;
  /** "작년 이맘때" 등에서 제목/키워드만 미리 채우고 싶을 때 — 날짜는 defaultDate를 그대로
   * 쓰므로, 날짜를 비워두고 싶으면 호출부가 defaultDate 자체를 ""로 넘기면 된다. */
  prefill?: { title: string; keywordMain: string | null; keywordSub: string | null } | null;
  /** 지정하면 수정 모드로 열림 — 기존 값을 프리필하고 저장 시 createSchedule 대신
   * updateSchedule을 호출한다. 가상 인스턴스(isVirtual)면 originalId로 저장/삭제하고
   * "반복 일정의 원본을 수정합니다" 안내를 보여준다. */
  existingSchedule?: ExpandedSchedule | null;
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
  const [showInShareLink, setShowInShareLink] = useState(false);
  const [keywordMain, setKeywordMain] = useState<string | null>(null);
  const [keywordSub, setKeywordSub] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState("");
  const [notifyOffset, setNotifyOffset] = useState<NotifyOffset | null>(null);
  const [notifyCustomAt, setNotifyCustomAt] = useState("");
  const [recurType, setRecurType] = useState<RecurType>("none");
  const [recurCalendar, setRecurCalendar] = useState<RecurCalendar>("solar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 가상 인스턴스를 열면 실제로는 원본(originalId)을 수정/삭제해야 한다.
  const targetId = existingSchedule ? existingSchedule.originalId ?? existingSchedule.id : null;

  const activeGroup = REGISTRABLE_KEYWORD_GROUPS.find((g) => g.main === keywordMain);

  const toggleTarget = (memberId: string) => {
    setTargets((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const reset = (
    initialTitle = "",
    initialKeywordMain: string | null = null,
    initialKeywordSub: string | null = null
  ) => {
    setTitle(initialTitle);
    setDateStart(defaultDate);
    setIsRange(false);
    setDateEnd(defaultDate);
    setIsAllDay(true);
    setTimeStart("");
    setTimeEnd("");
    setTargets([]);
    setShowInShareLink(false);
    setKeywordMain(initialKeywordMain);
    setKeywordSub(initialKeywordSub);
    setMemo("");
    setIsImportant(false);
    setPlace("");
    setAmount("");
    setNotifyOffset(null);
    setNotifyCustomAt("");
    setRecurType("none");
    setRecurCalendar("solar");
    setDetailsOpen(false);
  };

  // 시트가 열릴 때마다 필드를 다시 채운다 — existingSchedule이 있으면 수정 모드로 전체
  // 필드를 프리필하고, 없으면 prefill(예: "작년 이맘때")로 제목/키워드만, 그것도 없으면
  // 빈 상태로. 시트가 상시 마운트된 채 open만 토글되는 구조라 필요.
  useEffect(() => {
    if (!open) return;
    setDeleteConfirmOpen(false);
    if (existingSchedule) {
      setTitle(existingSchedule.title);
      setDateStart(existingSchedule.date_start);
      setIsRange(Boolean(existingSchedule.date_end && existingSchedule.date_end !== existingSchedule.date_start));
      setDateEnd(existingSchedule.date_end ?? existingSchedule.date_start);
      setIsAllDay(existingSchedule.is_all_day);
      setTimeStart(existingSchedule.time_start ?? "");
      setTimeEnd(existingSchedule.time_end ?? "");
      setTargets(existingSchedule.target_members);
      setShowInShareLink(existingSchedule.is_shared);
      setKeywordMain(existingSchedule.keyword_main);
      setKeywordSub(existingSchedule.keyword_sub);
      setMemo(existingSchedule.memo ?? "");
      setIsImportant(existingSchedule.is_important);
      setPlace(existingSchedule.place ?? "");
      setAmount(existingSchedule.amount != null ? String(existingSchedule.amount) : "");
      setNotifyOffset(existingSchedule.notify_offset);
      setNotifyCustomAt(existingSchedule.notify_custom_at ?? "");
      setRecurType(existingSchedule.recur_type);
      setRecurCalendar(existingSchedule.recur_calendar);
      // 수정 모드는 기존에 채워둔 값을 바로 보여주는 게 자연스러우니 자세한 설정도 펼쳐둔다.
      setDetailsOpen(true);
    } else {
      reset(prefill?.title ?? "", prefill?.keywordMain ?? null, prefill?.keywordSub ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingSchedule]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    const input = {
      title,
      date_start: dateStart,
      date_end: isRange ? dateEnd : null,
      time_start: !isAllDay ? timeStart || null : null,
      time_end: !isAllDay ? timeEnd || null : null,
      target_members: targets,
      is_shared: showInShareLink,
      keyword_main: keywordMain,
      keyword_sub: keywordSub,
      is_important: isImportant,
      memo: memo || null,
      place: place || null,
      amount: amount ? Number(amount) : null,
      is_all_day: isAllDay,
      notify_offset: notifyOffset,
      notify_custom_at: notifyOffset === "custom" ? notifyCustomAt || null : null,
      recur_type: recurType,
      recur_calendar: recurType === "yearly" ? recurCalendar : ("solar" as RecurCalendar),
    };
    const result = targetId
      ? await updateSchedule(targetId, input)
      : await createSchedule(workspaceId, input);
    setIsSubmitting(false);

    if (result.ok) {
      showToast(targetId ? "일정이 수정되었습니다." : "일정이 등록되었습니다.");
      reset();
      onClose();
    } else {
      showToast((result as { message?: string }).message ?? "일정 처리에 실패했습니다.");
    }
  };

  const handleDelete = async () => {
    if (!targetId) return;
    setIsSubmitting(true);
    const result = await deleteSchedule(targetId);
    setIsSubmitting(false);
    if (result.ok) {
      showToast("일정이 삭제되었습니다.");
      onClose();
    } else {
      showToast(result.message);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">
          {existingSchedule ? "일정 수정" : "일정 등록"}
        </h2>

        {existingSchedule?.isVirtual && (
          <p className="rounded-xl bg-cream px-3 py-2.5 text-[12px] text-stone">
            반복 일정의 원본을 수정합니다.
          </p>
        )}

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
                  ["lunar", "음력으로 반복 (생신·제사)"],
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
          <span className="text-[12px] font-medium text-stone">키워드 (선택)</span>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {REGISTRABLE_KEYWORD_GROUPS.map((g) => (
              <button
                key={g.main}
                onClick={() => {
                  setKeywordMain(keywordMain === g.main ? null : g.main);
                  setKeywordSub(null);
                }}
                className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium"
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
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pl-2">
              {activeGroup.subs.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setKeywordSub(keywordSub === sub ? null : sub)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${
                    keywordSub === sub ? "bg-ink text-cream" : "bg-cream text-stone"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex items-center gap-1 self-start text-[12px] font-medium text-stone"
        >
          자세한 설정
          <IconChevronDown size={14} className={detailsOpen ? "rotate-180" : ""} />
        </button>

        {detailsOpen && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-stone">누구의 일정인가요</span>
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
              <span className="text-[12px] font-medium text-stone">알림</span>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                {NOTIFY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNotifyOffset(notifyOffset === opt.value ? null : opt.value)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
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

            <PlaceInput value={place} onChange={setPlace} />

            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모 (준비물 등 자유롭게)"
              rows={3}
              className="rounded-xl p-3 text-[13px]"
            />

            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="금액 (선택)"
              className="h-11 rounded-xl px-3 text-[13px]"
            />

            <label className="flex items-center justify-between text-[13px] text-ink">
              중요한 일정인가요
              <input
                type="checkbox"
                checked={isImportant}
                onChange={(e) => setIsImportant(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between text-[13px] text-ink">
              외부 공유 링크에 표시
              <input
                type="checkbox"
                checked={showInShareLink}
                onChange={(e) => setShowInShareLink(e.target.checked)}
              />
            </label>
          </div>
        )}

        {deleteConfirmOpen ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink">정말 삭제하시겠어요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 rounded-2xl bg-cream py-3 text-[14px] font-medium text-stone"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex flex-1 items-center justify-center rounded-2xl bg-terra py-3 text-[14px] font-medium text-white disabled:opacity-50"
              >
                삭제하기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {existingSchedule && (
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isSubmitting}
                className="flex h-12 items-center justify-center rounded-2xl bg-cream px-5 text-[15px] font-medium text-terra"
              >
                삭제
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream"
            >
              {existingSchedule ? "저장하기" : "등록하기"}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
