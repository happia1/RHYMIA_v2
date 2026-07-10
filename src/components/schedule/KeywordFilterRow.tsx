"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TagChip } from "@/components/ui/TagChip";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";

/** 달력 아래로 옮겨온 키워드 필터(공휴일/여행/행사/교육/건강/기타) — 월간 뷰 전용. */
export function KeywordFilterRow({
  keywordMain,
  keywordSub,
}: {
  keywordMain?: string;
  keywordSub?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.push(`/schedule?${next.toString()}`);
  };

  const activeGroup = KEYWORD_GROUPS.find((g) => g.main === keywordMain);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-3">
        {KEYWORD_GROUPS.map((g) => (
          <TagChip
            key={g.main}
            label={g.main}
            color={g.color}
            selected={keywordMain === g.main}
            onClick={() =>
              setParams(
                keywordMain === g.main
                  ? { keywordMain: null, keywordSub: null }
                  : { keywordMain: g.main, keywordSub: null }
              )
            }
          />
        ))}
      </div>

      {activeGroup && activeGroup.subs.length > 0 && (
        <div className="flex flex-wrap gap-3 pl-2">
          {activeGroup.subs.map((sub) => (
            <TagChip
              key={sub}
              label={sub}
              color={activeGroup.color}
              selected={keywordSub === sub}
              onClick={() => setParams({ keywordSub: keywordSub === sub ? null : sub })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
