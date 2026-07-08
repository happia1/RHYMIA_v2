"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconBell, IconSettings } from "@tabler/icons-react";
import type { WeatherData } from "@/lib/weather";
import { WEEKDAY_LABEL } from "@/lib/date";
import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { mirror } from "@/lib/homeTheme";

function formatDate(date: Date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}월 ${d}일 ${WEEKDAY_LABEL[date.getDay()]}요일`;
}

export function HomeHeader({
  displayName,
  avatarColor,
  avatarTextColor,
  avatarImageUrl,
  statusText,
  weather,
  nowIso,
}: {
  displayName: string;
  avatarColor: string;
  avatarTextColor: string;
  avatarImageUrl: string | null;
  statusText: string;
  weather: WeatherData | null;
  nowIso: string;
}) {
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const period = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return (
    <div className="flex flex-col gap-label-gap">
      <div className="flex items-center justify-end gap-3">
        <Link href="/notifications" aria-label="알림">
          <IconBell size={20} className={mirror.secondary} />
        </Link>
        <Link href="/settings" aria-label="설정">
          <IconSettings size={20} className={mirror.secondary} />
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        {/* 왼쪽: 날씨 — 구글 스마트 디스플레이 스타일 대칭 배치 */}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-[40px] font-light leading-none ${mirror.primary}`}>
              {weather ? `${weather.tempC}°` : "-°"}
            </span>
            {weather && <span className="text-[26px] leading-none">{weather.icon}</span>}
          </div>
          {weather && (
            <span className={`truncate text-[15px] ${mirror.primary}`}>
              {weather.description}
            </span>
          )}
          <span className={`text-[10px] uppercase tracking-[0.15em] ${mirror.muted}`}>
            서울
          </span>
        </div>

        {/* 오른쪽: 시간 — 오른쪽 정렬 */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-[56px] font-light leading-none ${mirror.primary}`}>
              {hour12}:{String(now.getMinutes()).padStart(2, "0")}
            </span>
            <span className={`text-[13px] font-medium ${mirror.secondary}`}>{period}</span>
          </div>
          <span className={`text-[12px] ${mirror.secondary}`}>{formatDate(now)}</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <Avatar
          name={displayName}
          color={avatarColor}
          textColor={avatarTextColor}
          imageUrl={avatarImageUrl}
          size={AVATAR_SIZE.mirror}
        />
        <span className={`min-w-0 flex-1 truncate text-[13px] ${mirror.secondary}`}>
          {statusText}
        </span>
      </div>
    </div>
  );
}
