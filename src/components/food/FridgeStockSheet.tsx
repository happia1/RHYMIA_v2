"use client";

import { useState, useTransition } from "react";
import { IconCheck } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { useShoppingSheet } from "@/components/shopping/ShoppingSheetContext";
import { addFridgeItem, deleteFridgeItem } from "@/app/(main)/food/actions";
import type { FridgeCategory, FridgeItem } from "@/types";

// 태블릿 식탁 탭(FoodTabletHome)의 냉장고 묘사 UI도 이 라벨 매핑을 그대로 재사용한다.
export const FRIDGE_CATEGORIES: { value: FridgeCategory; label: string }[] = [
  { value: "cold", label: "냉장" },
  { value: "frozen", label: "냉동" },
  { value: "room", label: "상온" },
];

/** 끼니 추가 화면과 식탁 탭 홈 화면 양쪽에서 같은 재고 데이터/로직을 쓰도록 공용으로 추출.
 * 재고 보다가 부족한 걸 바로 장바구니에 적을 수 있도록 하단에 장볼 것 시트로 넘어가는 링크를 둔다
 * (이 시트를 닫고 전역 GlobalShoppingSheet를 여는 방식 — 두 바텀시트를 동시에 띄우지 않음).
 *
 * `onToggleItem`을 넘기면(끼니 등록 화면 전용) 항목이 탭으로 선택/해제되는 재료 선택 모드가
 * 된다 — 선택 상태 자체는 호출부(AddMealScreen)가 들고 있어서, 이 시트를 닫아도 그대로
 * 유지되고 폼의 메뉴 칩으로 이어진다. 안 넘기면(식탁 탭 홈 등) 예전처럼 그냥 보기 전용. */
export function FridgeStockSheet({
  open,
  onClose,
  workspaceId,
  items,
  selectedNames,
  onToggleItem,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  items: FridgeItem[];
  selectedNames?: string[];
  onToggleItem?: (name: string) => void;
}) {
  const [category, setCategory] = useState<FridgeCategory>("cold");
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const { open: openShoppingSheet } = useShoppingSheet();

  const selectable = Boolean(onToggleItem);
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
            className="h-11 flex-1 rounded-xl px-3 text-[12px]"
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
          {filtered.map((item) => {
            const isSelected = selectable && selectedNames?.includes(item.name);
            return (
              <div
                key={item.id}
                onClick={selectable ? () => onToggleItem!(item.name) : undefined}
                className={`flex items-center justify-between ${selectable ? "cursor-pointer" : ""}`}
              >
                <span className="flex items-center gap-2 text-[12px] text-ink">
                  {selectable && (
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected ? "border-honey bg-honey" : "border-border-light"
                      }`}
                    >
                      {isSelected && <IconCheck size={10} className="text-white" stroke={3} />}
                    </span>
                  )}
                  {item.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startTransition(() => deleteFridgeItem(item.id));
                  }}
                  className="text-[12px] text-stone"
                >
                  삭제
                </button>
              </div>
            );
          })}
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
