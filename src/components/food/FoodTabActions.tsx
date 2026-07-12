"use client";

import { useState } from "react";
import { IconFridge, IconShoppingCart } from "@tabler/icons-react";
import { FridgeStockSheet } from "@/components/food/FridgeStockSheet";
import { useShoppingSheet } from "@/components/shopping/ShoppingSheetContext";
import type { FridgeItem } from "@/types";

/** 식탁 탭 최하단(오늘의 제안 아래) — 현재 재고 확인(끼니 추가 화면과 동일한 FridgeStockSheet
 * 재사용, 중복 구현 금지)과 장볼 것 입력(전역 GlobalShoppingSheet, 항상 "장볼 것" 탭으로 열림)
 * 두 줄을 라인 스타일(구분선만, 박스 없음)로 둔다. */
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
      <div className="flex flex-col">
        <button
          onClick={() => setStockOpen(true)}
          className="flex items-center gap-2 py-2.5 text-left text-[13px] text-ink"
        >
          <IconFridge size={16} className="text-honey" />
          현재 재고 확인
        </button>
        <button
          onClick={openShoppingSheet}
          className="flex items-center gap-2 border-t border-border-light py-2.5 text-left text-[13px] text-ink"
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
