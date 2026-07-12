"use client";

import { useState } from "react";
import { IconFridge, IconShoppingCart } from "@tabler/icons-react";
import { FridgeStockSheet } from "@/components/food/FridgeStockSheet";
import { useShoppingSheet } from "@/components/shopping/ShoppingSheetContext";
import type { FridgeItem } from "@/types";

/** 식탁 탭 최하단(오늘의 제안 아래) — 현재 재고 확인(끼니 추가 화면과 동일한 FridgeStockSheet
 * 재사용, 중복 구현 금지)과 장볼 것 입력(전역 GlobalShoppingSheet, 항상 "장볼 것" 탭으로 열림)
 * 두 버튼을 나란히 둔다. */
export function FoodTabActions({
  workspaceId,
  fridgeItems,
}: {
  workspaceId: string;
  fridgeItems: FridgeItem[];
}) {
  const [stockOpen, setStockOpen] = useState(false);
  const { open: openShoppingSheet } = useShoppingSheet();

  return (
    <>
      <div className="flex gap-3">
        <button
          onClick={() => setStockOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border-light py-3 text-[13px] font-medium text-ink"
        >
          <IconFridge size={16} className="text-honey" />
          현재 재고 확인
        </button>
        <button
          onClick={openShoppingSheet}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border-light py-3 text-[13px] font-medium text-ink"
        >
          <IconShoppingCart size={16} className="text-honey" />
          장볼 것 입력하기
        </button>
      </div>

      <FridgeStockSheet
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        workspaceId={workspaceId}
        items={fridgeItems}
      />
    </>
  );
}
