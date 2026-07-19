import { TabPageFrame } from "@/components/ui/TabPageFrame";

/** 탭 전환 시 즉시 반응하도록 하는 최소 스켈레톤 — 섹션 라벨 자리와 헤어라인만 표시. */
export default function BoardLoading() {
  return (
    <TabPageFrame className="animate-pulse gap-section px-4 pt-6">
      <div className="h-5 w-16 shrink-0 rounded-full bg-[var(--hairline)]" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-label-gap">
          <div className="h-3 w-20 rounded-full bg-[var(--hairline)]" />
          <div className="h-px w-full bg-[var(--hairline)]" />
        </div>
      ))}
    </TabPageFrame>
  );
}
