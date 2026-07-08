"use client";

import { useState } from "react";
import { IconPhoto } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { Textarea } from "@/components/ui/Input";
import { createDiary } from "@/app/(main)/schedule/actions";
import { WEEKDAY_LABEL } from "@/lib/date";
import type { WeatherData } from "@/lib/weather";

const MOODS = ["😊", "😄", "😐", "😢", "😠", "😴", "🥳", "😰"];

export function DiarySheet({
  open,
  onClose,
  workspaceId,
  defaultDate,
  weather,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  defaultDate: string;
  weather: WeatherData | null;
}) {
  const { showToast } = useToast();
  const [mood, setMood] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const date = new Date(defaultDate);

  const reset = () => {
    setMood(null);
    setPhotoUrl("");
    setContent("");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await createDiary(workspaceId, {
      date: defaultDate,
      day_of_week: date.getDay(),
      weather: weather ? `${weather.icon} ${weather.tempC}°` : null,
      mood,
      photo_url: photoUrl || null,
      content: content || null,
    });
    setIsSubmitting(false);

    if (result.ok) {
      showToast("다이어리가 등록되었습니다.");
      reset();
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">다이어리</h2>

        <div className="flex items-center justify-between text-[13px] text-stone">
          <span>
            {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}일{" "}
            {WEEKDAY_LABEL[date.getDay()]}요일
          </span>
          {weather && (
            <span>
              {weather.icon} {weather.tempC}°
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">오늘의 기분</span>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setMood(mood === emoji ? null : emoji)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-[20px] ${
                  mood === emoji ? "bg-ink" : "bg-cream"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘의 기록"
          rows={4}
          className="rounded-xl p-3 text-[13px]"
        />

        <label className="flex items-center gap-2 rounded-xl border border-input-border px-3 py-2.5 text-[13px] text-stone">
          <IconPhoto size={18} className="text-ocean" />
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="사진 URL (선택)"
            className="flex-1 bg-transparent text-[13px] text-input-text placeholder:text-input-placeholder focus:outline-none"
          />
        </label>

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
