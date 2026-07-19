"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";

/** 일정 탭 멤버 필터 — 섹션 라벨과 같은 줄 오른쪽 끝에 "전체 ▾" 형태 드롭다운으로 놓는다
 * (2026-07-12 칩 줄에서 이동). Fridge에 올라오는 일정은 전부 가족 공유가 전제라 공유/개인
 * 스코프 구분 자체가 없어 [전체] + 멤버(managed 포함) 목록만 있으면 된다. */
export function MemberFilterRow({
  members,
  target,
}: {
  members: { id: string; display_name: string; avatar_color: string }[];
  target: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const setTarget = (value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete("target");
    else next.set("target", value);
    router.push(`/schedule?${next.toString()}`);
    setOpen(false);
  };

  const activeLabel =
    target === "all" ? "전체" : members.find((m) => m.id === target)?.display_name ?? "전체";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 text-[12px] tracking-[0.1em] text-[var(--text-muted)]"
      >
        {activeLabel}
        <IconChevronDown size={11} className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <>
          <button aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 z-40" />
          <div className="absolute right-0 top-full z-50 mt-1.5 flex min-w-20 flex-col gap-0.5 rounded-xl border border-border-light bg-surface py-1.5 shadow-sm">
            <button
              onClick={() => setTarget(null)}
              className={`px-3 py-1.5 text-left text-[14px] ${
                target === "all" ? "font-medium text-ink" : "text-stone"
              }`}
            >
              전체
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setTarget(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-left text-[14px] ${
                  target === m.id ? "font-medium text-ink" : "text-stone"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: m.avatar_color }}
                />
                {m.display_name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
