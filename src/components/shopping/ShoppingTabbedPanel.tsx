"use client";

import { useState } from "react";
import { ShoppingListPanel } from "@/components/shopping/ShoppingListPanel";
import { GroceryHistoryTab } from "@/components/shopping/GroceryHistoryTab";

/** "장볼 것 | 기록" 탭 스위처 — 모바일 전역 장바구니 시트(GlobalShoppingSheet)와 태블릿
 * 식탁 탭 우측 하단 "뭐 사야하지" 확장 패널이 완전히 동일하게 재사용한다. 높이는 부모가
 * 결정(모바일은 고정 dvh 안, 태블릿은 아코디언이 내준 남는 flex 공간) — 여기서는
 * min-h-0 flex-1로 그 공간을 그대로 채우기만 한다. */
export function ShoppingTabbedPanel({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<"list" | "history">("list");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 gap-4 border-b border-border-light">
        {(["list", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 pb-2 text-[16px] font-medium ${
              tab === t ? "border-honey text-ink" : "border-transparent text-[var(--text-muted)]"
            }`}
          >
            {t === "list" ? "장볼 것" : "기록"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "list" ? (
          <ShoppingListPanel workspaceId={workspaceId} />
        ) : (
          <GroceryHistoryTab workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
