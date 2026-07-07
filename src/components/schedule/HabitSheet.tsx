"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { createHabit } from "@/app/(main)/schedule/actions";
import { WEEKDAY_LABEL } from "@/lib/date";
import type { HabitRepeatType } from "@/types";

const REPEAT_OPTIONS: { value: HabitRepeatType; label: string }[] = [
  { value: "daily", label: "매일" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "custom", label: "직접" },
];

export function HabitSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [repeatType, setRepeatType] = useState<HabitRepeatType>("daily");
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [targetDuration, setTargetDuration] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyTime, setNotifyTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const reset = () => {
    setName("");
    setStartTime("");
    setRepeatType("daily");
    setRepeatDays([]);
    setTargetDuration("");
    setNotifyEnabled(false);
    setNotifyTime("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    const result = await createHabit({
      name,
      start_time: startTime || null,
      repeat_type: repeatType,
      repeat_days: repeatType === "weekly" ? repeatDays : [],
      target_duration: targetDuration || null,
      notify_enabled: notifyEnabled,
      notify_time: notifyEnabled ? notifyTime || null : null,
    });
    setIsSubmitting(false);

    if (result.ok) {
      showToast("습관이 등록되었습니다.");
      reset();
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">습관 등록</h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="습관 이름 (예: 아침 6시 기상)"
          className="h-11 rounded-xl border border-border-light px-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
        />

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">시작 시간</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">반복 주기</span>
          <div className="flex flex-wrap gap-2">
            {REPEAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRepeatType(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                  repeatType === opt.value ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {repeatType === "weekly" && (
            <div className="flex flex-wrap gap-2 pl-1">
              {WEEKDAY_LABEL.map((label, day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium ${
                    repeatDays.includes(day) ? "bg-ink text-cream" : "bg-cream text-stone"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">목표 기간</span>
          <input
            value={targetDuration}
            onChange={(e) => setTargetDuration(e.target.value)}
            placeholder="예: 3개월"
            className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
          />
        </div>

        <label className="flex items-center justify-between text-[13px] text-ink">
          알림
          <input
            type="checkbox"
            checked={notifyEnabled}
            onChange={(e) => setNotifyEnabled(e.target.checked)}
          />
        </label>
        {notifyEnabled && (
          <input
            type="time"
            value={notifyTime}
            onChange={(e) => setNotifyTime(e.target.value)}
            className="h-11 rounded-xl border border-border-light px-3 text-[13px] text-ink focus:outline-none"
          />
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
