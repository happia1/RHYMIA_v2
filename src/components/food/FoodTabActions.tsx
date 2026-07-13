"use client";

import { useState } from "react";
import { IconFridge, IconShoppingCart } from "@tabler/icons-react";
import { FridgeStockSheet } from "@/components/food/FridgeStockSheet";
import { useShoppingSheet } from "@/components/shopping/ShoppingSheetContext";
import type { FridgeItem } from "@/types";

/** 식탁 탭 오늘의 제안 위(끼니 목록 아래) — 재고 확인(끼니 추가 화면과 동일한 FridgeStockSheet
 * 재사용, 중복 구현 금지)과 장볼 것 입력(전역 GlobalShoppingSheet, 항상 "장볼 것" 탭으로 열림)
 * 을 2단(왼쪽/오른쪽)으로 나란히 두고, 가운데 세로 구분선만으로 나눈다(박스 없음). */
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
      <div className="grid grid-cols-2">
        <button
          onClick={() => setStockOpen(true)}
          className="flex items-center gap-2 py-2.5 pr-3 text-left text-[13px] text-ink"
        >
          <IconFridge size={16} className="text-honey" />
          집에 뭐 있지
        </button>
        <button
          onClick={openShoppingSheet}
          className="flex items-center gap-2 border-l border-border-light py-2.5 pl-3 text-left text-[13px] text-ink"
        >
          <IconShoppingCart size={16} className="text-honey" />
          뭐 사야하지
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
