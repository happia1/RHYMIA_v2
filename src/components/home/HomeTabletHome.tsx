"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WeatherData } from "@/lib/weather";
import { solarToLunar } from "@/lib/lunar";
import { WEEKDAY_LABEL } from "@/lib/date";
import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_SIZE } from "@/lib/uiTokens";
import { mirror } from "@/lib/homeTheme";
import { NoticeDetailSheet } from "@/components/board/NoticeDetailSheet";
import { PinnedNoticeBanner } from "@/components/home/PinnedNoticeBanner";
import { HomePhotoFrame } from "@/components/home/HomePhotoFrame";
import type { FamilyMemberStatus } from "@/components/home/HomeHeader";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment } from "@/types";

function formatDate(date: Date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}. ${d}. ${WEEKDAY_LABEL[date.getDay()]}요일`;
}

function TabletWeather({ weather }: { weather: WeatherData | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-[38px] font-light leading-none ${mirror.primary}`}>
          {weather ? `${weather.tempC}°` : "-°"}
        </span>
        {weather && <span className="text-[20px] leading-none">{weather.icon}</span>}
      </div>
      {weather && (
        <span className={`text-[11.5px] ${mirror.muted}`}>
          {weather.description}
          {weather.tempMinC !== null && weather.tempMaxC !== null
            ? ` · 최저 ${weather.tempMinC}° 최고 ${weather.tempMaxC}°`
            : ""}
        </span>
      )}
      <span className={`text-[10px] ${mirror.muted}`}>{weather ? weather.location : "서울 강동구"}</span>
    </div>
  );
}

function TabletClock({ nowIso }: { nowIso: string }) {
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const period = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const lunar = solarToLunar(now);

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-right leading-none">
        <span className={`mr-1.5 text-[14px] font-normal ${mirror.secondary}`}>{period}</span>
        <span className={`text-[54px] font-light tracking-tight ${mirror.primary}`}>
          {hour12}:{String(now.getMinutes()).padStart(2, "0")}
        </span>
      </p>
      <span className={`text-[13px] tracking-wide ${mirror.secondary}`}>
        {formatDate(now)}
        {lunar && <span className={mirror.muted}> · 음력 {lunar.month}.{lunar.day}</span>}
      </span>
    </div>
  );
}

function TabletFamilyList({ familyStatus }: { familyStatus: FamilyMemberStatus[] }) {
  if (familyStatus.length === 0) return null;
  return (
    <div className={`flex flex-col gap-1.5 border-b pb-3 ${mirror.hairline}`}>
      <span className={mirror.label}>가족</span>
      {familyStatus.map((m) => (
        <Link key={m.id} href={`/schedule?view=day&member=${m.id}`} className="flex items-center gap-2 py-0.5">
          <Avatar
            name={m.display_name}
            color={m.avatar_color}
            textColor={m.avatar_text_color}
            imageUrl={m.avatar_image_url}
            size={AVATAR_SIZE.mirror}
          />
          <span className={`w-12 shrink-0 truncate text-[12px] ${mirror.primary}`}>{m.display_name}</span>
          <span className={`truncate text-[11.5px] ${mirror.muted}`}>{m.statusText}</span>
        </Link>
      ))}
    </div>
  );
}

function TabletLatestNote({
  note,
  author,
  onOpen,
}: {
  note: Notice | null;
  author: string;
  onOpen: () => void;
}) {
  if (!note) return null;
  return (
    <button onClick={onOpen} className={`flex flex-col gap-1 border-b py-3 text-left ${mirror.hairline}`}>
      <span className={mirror.label}>쪽지</span>
      <p className={`line-clamp-2 text-[12px] leading-relaxed ${mirror.primary}`}>{note.content}</p>
      <span className={`text-[9.5px] ${mirror.muted}`}>{author}</span>
    </button>
  );
}

/** 1024px 이상(태블릿) 전용 홈 레이아웃 — 가로/세로 두 배치 모두 이 컴포넌트가 담당하고
 * CSS `orientation` 미디어 쿼리로 실제 화면 방향에 맞는 쪽만 보인다(JS 토글 없음). 위계는
 * "특대는 시계·온도 둘뿐" — 나머지(가족상태/쪽지/공지/오늘 뭐하지/오늘 뭐먹지)는 전부
 * 기존 모바일 위젯이 쓰는 것과 같은 데이터/컴포넌트를 재사용한다("오늘 뭐하지"/"오늘 뭐먹지"는
 * 아예 같은 ReactNode를 그대로 전달받아 배치만 바꾼다). */
export function HomeTabletHome({
  familyStatus,
  weather,
  nowIso,
  pinnedMemos,
  stickers,
  workspaceId,
  currentUserId,
  membersById,
  commentsByNotice,
  mealTodaySection,
  scheduleTodaySection,
  photoUrls,
}: {
  familyStatus: FamilyMemberStatus[];
  weather: WeatherData | null;
  nowIso: string;
  pinnedMemos: Notice[];
  /** "하고싶은 말" 스티커 전체 목록(최신순) — 이 화면은 그중 최신 1건만 보여준다. */
  stickers: Notice[];
  workspaceId: string;
  currentUserId: string;
  membersById: Record<string, WorkspaceMemberInfo>;
  commentsByNotice: Record<string, NoticeComment[]>;
  mealTodaySection: React.ReactNode;
  scheduleTodaySection: React.ReactNode;
  photoUrls: string[];
}) {
  const [openMemo, setOpenMemo] = useState<Notice | null>(null);

  const latestNote = stickers[0] ?? null;
  const noteAuthor = latestNote?.created_by
    ? membersById[latestNote.created_by]?.display_name ?? "가족"
    : "가족";

  const leftColumn = (
    <>
      <TabletFamilyList familyStatus={familyStatus} />
      <TabletLatestNote note={latestNote} author={noteAuthor} onOpen={() => latestNote && setOpenMemo(latestNote)} />
      <PinnedNoticeBanner memos={pinnedMemos} membersById={membersById} onSelect={setOpenMemo} />
    </>
  );

  const rightColumn = (
    <>
      {scheduleTodaySection}
      {mealTodaySection}
    </>
  );

  return (
    <>
      {/* 가로 */}
      <div className="hidden h-full lg:landscape:grid lg:landscape:grid-cols-mirror lg:landscape:items-stretch lg:landscape:gap-8">
        <div className="flex min-h-0 flex-col overflow-y-auto">
          <div className="mb-5 shrink-0">
            <TabletWeather weather={weather} />
          </div>
          {leftColumn}
        </div>
        <div className="min-h-0">
          <HomePhotoFrame photoUrls={photoUrls} />
        </div>
        <div className="flex min-h-0 flex-col overflow-y-auto">
          <div className="mb-5 shrink-0">
            <TabletClock nowIso={nowIso} />
          </div>
          {rightColumn}
        </div>
      </div>

      {/* 세로 */}
      <div className="hidden h-full lg:portrait:flex lg:portrait:flex-col">
        <div className="flex shrink-0 items-start justify-between">
          <TabletWeather weather={weather} />
          <TabletClock nowIso={nowIso} />
        </div>
        <div className="my-4 min-h-0 flex-1">
          <HomePhotoFrame photoUrls={photoUrls} />
        </div>
        <div className="flex shrink-0 gap-6 overflow-y-auto">
          <div className="flex flex-1 flex-col">{leftColumn}</div>
          <div className={`w-px shrink-0 ${mirror.hairlineBg}`} />
          <div className="flex flex-1 flex-col">{rightColumn}</div>
        </div>
      </div>

      <NoticeDetailSheet
        notice={openMemo}
        onClose={() => setOpenMemo(null)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        membersById={membersById}
        commentsByNotice={commentsByNotice}
      />
    </>
  );
}
