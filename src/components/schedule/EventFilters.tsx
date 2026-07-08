"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { TagChip } from "@/components/ui/TagChip";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";

const SCOPES = [
  { value: "all", label: "전체" },
  { value: "shared", label: "공유" },
  { value: "private", label: "프라이빗" },
];

export function EventFilters({
  members,
  scope,
  target,
  keywordMain,
  keywordSub,
}: {
  members: { user_id: string; display_name: string }[];
  scope: string;
  target: string;
  keywordMain?: string;
  keywordSub?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [targetOpen, setTargetOpen] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.push(`/schedule?${next.toString()}`);
  };

  const activeGroup = KEYWORD_GROUPS.find((g) => g.main === keywordMain);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border-light bg-surface p-3">
      <div className="flex gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => setParam("scope", s.value === "all" ? null : s.value)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium ${
              scope === s.value ? "bg-ink text-cream" : "bg-cream text-stone"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setTargetOpen((v) => !v)}
        className="flex items-center gap-1 self-start text-[12px] font-medium text-stone"
      >
        대상 필터
        <IconChevronDown
          size={14}
          className={`transition-transform ${targetOpen ? "rotate-180" : ""}`}
        />
      </button>

      {targetOpen && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setParam("target", null)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium ${
              target === "all" ? "bg-ink text-cream" : "bg-cream text-stone"
            }`}
          >
            전체
          </button>
          {members.map((m) => (
            <button
              key={m.user_id}
              onClick={() => setParam("target", m.user_id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                target === m.user_id ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              {m.display_name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {KEYWORD_GROUPS.map((g) => (
          <TagChip
            key={g.main}
            label={g.main}
            color={g.color}
            selected={keywordMain === g.main}
            onClick={() => {
              if (keywordMain === g.main) {
                setParam("keywordMain", null);
                setParam("keywordSub", null);
              } else {
                setParam("keywordMain", g.main);
                setParam("keywordSub", null);
              }
            }}
          />
        ))}
      </div>

      {activeGroup && activeGroup.subs.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-2">
          {activeGroup.subs.map((sub) => (
            <TagChip
              key={sub}
              label={sub}
              color={activeGroup.color}
              selected={keywordSub === sub}
              onClick={() => setParam("keywordSub", keywordSub === sub ? null : sub)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
