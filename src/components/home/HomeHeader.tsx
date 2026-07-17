"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconBell, IconSettings, IconPin } from "@tabler/icons-react";
import type { WeatherData } from "@/lib/weather";
import { WEEKDAY_LABEL } from "@/lib/date";
import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { mirror } from "@/lib/homeTheme";

export interface FamilyMemberStatus {
  id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
  emoji: string;
  statusText: string;
}

function formatDate(date: Date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}월 ${d}일 ${WEEKDAY_LABEL[date.getDay()]}요일`;
}

export function HomeHeader({
  familyStatus,
  weather,
  nowIso,
  pinnedMemo,
}: {
  familyStatus: FamilyMemberStatus[];
  weather: WeatherData | null;
  nowIso: string;
  /** 게시판(메모)에서 상단 고정한 글 중 가장 최근 1건 — 없으면 이 줄 자체를 렌더하지 않는다
   * (자리 미리 확보 안 함, 홈 하단 여백은 그대로 유지). */
  pinnedMemo?: { id: string; content: string } | null;
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
        {/* 왼쪽: 날씨 — 위치 → 기온+아이콘 → 최저/최고 순 배치 */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className={`truncate text-[10px] ${mirror.muted}`}>
            {weather ? `${weather.location} · ${weather.description}` : "서울"}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-[40px] font-light leading-none ${mirror.primary}`}>
              {weather ? `${weather.tempC}°` : "-°"}
            </span>
            {weather && <span className="text-[26px] leading-none">{weather.icon}</span>}
          </div>
          {weather && weather.tempMinC !== null && weather.tempMaxC !== null && (
            <span className={`text-[10px] ${mirror.muted}`}>
              최저 {weather.tempMinC}° · 최고 {weather.tempMaxC}°
            </span>
          )}
        </div>

        {/* 오른쪽: 시간 — 오른쪽 정렬, PM/AM이 시간 앞에 작게 */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-[13px] font-medium ${mirror.secondary}`}>{period}</span>
            <span className={`text-[56px] font-light leading-none ${mirror.primary}`}>
              {hour12}:{String(now.getMinutes()).padStart(2, "0")}
            </span>
          </div>
          <span className={`text-[12px] ${mirror.secondary}`}>{formatDate(now)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto">
        {familyStatus.map((m) => (
          <Link
            key={m.id}
            href={`/schedule?view=day&member=${m.id}`}
            className="flex shrink-0 items-center gap-1.5"
          >
            <Avatar
              name={m.display_name}
              color={m.avatar_color}
              textColor={m.avatar_text_color}
              imageUrl={m.avatar_image_url}
              size={AVATAR_SIZE.mirror}
            />
            <span className={`whitespace-nowrap text-[12px] ${mirror.secondary}`}>
              {m.display_name} {m.statusText}
            </span>
          </Link>
        ))}
      </div>

      {pinnedMemo && (
        <Link href="/board" className="flex items-center gap-1.5">
          <IconPin size={11} className={`shrink-0 ${mirror.muted}`} />
          <span className={`truncate text-[11px] ${mirror.muted}`}>{pinnedMemo.content}</span>
        </Link>
      )}
    </div>
  );
}
