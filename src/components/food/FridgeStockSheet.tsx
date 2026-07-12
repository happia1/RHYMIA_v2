"use client";

import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { useShoppingSheet } from "@/components/shopping/ShoppingSheetContext";
import { addFridgeItem, deleteFridgeItem } from "@/app/(main)/food/actions";
import type { FridgeCategory, FridgeItem } from "@/types";

const FRIDGE_CATEGORIES: { value: FridgeCategory; label: string }[] = [
  { value: "cold", label: "냉장" },
  { value: "frozen", label: "냉동" },
  { value: "room", label: "상온" },
];

/** 끼니 추가 화면과 식탁 탭 홈 화면 양쪽에서 같은 재고 데이터/로직을 쓰도록 공용으로 추출.
 * 재고 보다가 부족한 걸 바로 장바구니에 적을 수 있도록 하단에 장볼 것 시트로 넘어가는 링크를 둔다
 * (이 시트를 닫고 전역 GlobalShoppingSheet를 여는 방식 — 두 바텀시트를 동시에 띄우지 않음). */
export function FridgeStockSheet({
  open,
  onClose,
  workspaceId,
  items,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  items: FridgeItem[];
}) {
  const [category, setCategory] = useState<FridgeCategory>("cold");
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const { open: openShoppingSheet } = useShoppingSheet();

  const filtered = items.filter((i) => i.category === category);

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft("");
    startTransition(() => addFridgeItem(workspaceId, value, category));
  };

  const goToShoppingList = () => {
    onClose();
    openShoppingSheet();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {FRIDGE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                category === c.value ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="재료 이름"
            className="h-11 flex-1 rounded-xl px-3 text-[14px]"
          />
          <button
            onClick={handleAdd}
            disabled={isPending}
            className="rounded-xl bg-ink px-4 text-[13px] font-medium text-cream"
          >
            추가
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {filtered.length === 0 && (
            <p className="text-[13px] text-stone">등록된 재료가 없어요</p>
          )}
          {filtered.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span className="text-[14px] text-ink">{item.name}</span>
              <button
                onClick={() => startTransition(() => deleteFridgeItem(item.id))}
                className="text-[12px] text-stone"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={goToShoppingList}
          className="self-start text-[13px] font-medium text-honey"
        >
          부족한 건 장볼 것에 적으러 가기
        </button>
      </div>
    </BottomSheet>
  );
}
