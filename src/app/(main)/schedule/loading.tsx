import { TabPageFrame } from "@/components/ui/TabPageFrame";

/** 탭 전환 시 즉시 반응하도록 하는 최소 스켈레톤 — 섹션 라벨 자리와 헤어라인만 표시. */
export default function ScheduleLoading() {
  return (
    <TabPageFrame className="animate-pulse gap-section px-4 pt-6">
      <div className="flex shrink-0 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-10 rounded-full bg-[var(--hairline)]" />
        ))}
      </div>
      <div className="h-px w-full shrink-0 bg-[var(--hairline)]" />
      <div className="flex flex-col gap-label-gap">
        <div className="h-3 w-24 rounded-full bg-[var(--hairline)]" />
      </div>
    </TabPageFrame>
  );
}
