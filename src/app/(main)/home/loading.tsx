import { TabPageFrame } from "@/components/ui/TabPageFrame";

/** 탭 전환 시 즉시 반응하도록 하는 최소 스켈레톤 — 섹션 라벨 자리와 헤어라인만 표시.
 * 실제 홈 위젯 4개(끼니/오늘/하고싶은말/장바구니)와 자리만 맞춘다. */
export default function HomeLoading() {
  return (
    <TabPageFrame className="animate-pulse gap-section px-4 pt-6 pb-4">
      <div className="h-px w-full shrink-0 bg-[var(--hairline)]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-label-gap">
          <div className="h-3 w-20 rounded-full bg-[var(--hairline)]" />
          <div className="h-3 w-32 rounded-full bg-[var(--hairline)] opacity-60" />
        </div>
      ))}
    </TabPageFrame>
  );
}
