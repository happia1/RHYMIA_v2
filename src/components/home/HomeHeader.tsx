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
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-label-gap">
        <div className="flex items-baseline gap-2">
          <span className={`text-[56px] font-light leading-none ${mirror.primary}`}>
            {hour12}:{String(now.getMinutes()).padStart(2, "0")}
          </span>
          <span className={`text-[13px] font-medium ${mirror.secondary}`}>{period}</span>
        </div>

        <div className={`flex items-center gap-1.5 text-[13px] ${mirror.secondary}`}>
          <span>{formatDate(now)}</span>
          {weather && (
            <span>
              · {weather.icon} {weather.tempC}°C
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Avatar
            name={displayName}
            color={avatarColor}
            textColor={avatarTextColor}
            imageUrl={avatarImageUrl}
            size={AVATAR_SIZE.mirror}
          />
          <span className={`text-[13px] ${mirror.secondary}`}>{statusText}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/notifications" aria-label="알림">
          <IconBell size={20} className={mirror.secondary} />
        </Link>
        <Link href="/settings" aria-label="설정">
          <IconSettings size={20} className={mirror.secondary} />
        </Link>
      </div>
    </div>
  );
}
