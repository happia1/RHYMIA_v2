"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WeatherData } from "@/lib/weather";
import { WEEKDAY_LABEL } from "@/lib/date";
import { Avatar } from "@/components/ui/Avatar";

function formatClock(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${hour12}:${String(minutes).padStart(2, "0")}`;
}

function formatDate(date: Date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}월 ${d}일 ${WEEKDAY_LABEL[date.getDay()]}요일`;
}

export function HomeHeader({
  displayName,
  avatarColor,
  avatarTextColor,
  statusText,
  weather,
  nowIso,
}: {
  displayName: string;
  avatarColor: string;
  avatarTextColor: string;
  statusText: string;
  weather: WeatherData | null;
  nowIso: string;
}) {
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white p-5">
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-medium text-ink">{formatClock(now)}</span>
        <span className="flex items-center gap-1.5 text-[13px] text-stone">
          {formatDate(now)}
          {weather && (
            <span>
              · {weather.icon} {weather.tempC}°
            </span>
          )}
        </span>
      </div>

      <Link href="/settings" className="flex items-center gap-2">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[13px] font-medium text-ink">{displayName}</span>
          <span className="text-[12px] text-stone">{statusText}</span>
        </div>
        <Avatar name={displayName} color={avatarColor} textColor={avatarTextColor} size={36} />
      </Link>
    </div>
  );
}
