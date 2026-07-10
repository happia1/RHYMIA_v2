"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";

const SCOPES = [
  { value: "all", label: "전체" },
  { value: "shared", label: "공유" },
  { value: "private", label: "개인" },
];

export function EventFilters({
  members,
  scope,
  target,
}: {
  members: { id: string; display_name: string }[];
  scope: string;
  target: string;
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

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => setParam("scope", s.value === "all" ? null : s.value)}
              className={`text-[12px] font-medium ${
                scope === s.value ? "text-ink" : "text-[var(--text-muted)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setTargetOpen((v) => !v)}
          className="flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)]"
        >
          대상 필터
          <IconChevronDown
            size={14}
            className={`transition-transform ${targetOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {targetOpen && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setParam("target", null)}
            className={`text-[12px] font-medium ${
              target === "all" ? "text-ink" : "text-[var(--text-muted)]"
            }`}
          >
            전체
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setParam("target", m.id)}
              className={`text-[12px] font-medium ${
                target === m.id ? "text-ink" : "text-[var(--text-muted)]"
              }`}
            >
              {m.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
