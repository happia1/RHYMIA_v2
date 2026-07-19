"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { ShoppingTabbedPanel } from "@/components/shopping/ShoppingTabbedPanel";

export function GlobalShoppingSheet({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} tall>
      {/* 탭 콘텐츠를 고정 높이(기록 탭 기준 — 달력+목록이 있어 두 탭 중 더 크다) 안에 두고
          그 안에서만 스크롤되게 한다 — 안 그러면 "장볼 것"(짧음)과 "기록"(김) 사이를
          오갈 때마다 시트 전체 높이가 출렁였다. key로 열릴 때마다 재마운트해 탭을
          "장볼 것"으로 리셋한다(예전엔 useEffect로 처리하던 것). */}
      <div className="flex h-[65dvh] flex-col">
        <ShoppingTabbedPanel key={open ? "open" : "closed"} workspaceId={workspaceId} />
      </div>
    </BottomSheet>
  );
}
