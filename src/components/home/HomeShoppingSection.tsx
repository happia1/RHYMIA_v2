"use client";

import { IconShoppingCart } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { SectionLabel } from "@/components/home/SectionLabel";
import { useShoppingSheet } from "@/components/shopping/ShoppingSheetContext";
import type { ShoppingItem } from "@/types";

export function HomeShoppingSection({ shoppingItems }: { shoppingItems: ShoppingItem[] }) {
  const { open: openShoppingSheet } = useShoppingSheet();

  const activeShopping = shoppingItems.filter((i) => !i.is_purchased);
  const previewShopping = activeShopping.slice(0, 4);
  const restCount = activeShopping.length - previewShopping.length;

  return (
    <div className="flex flex-col gap-1.5">
      {/* + 버튼과 리스트 클릭 모두 같은 GlobalShoppingSheet를 연다 — 예전엔 서로 다른 시트였음 */}
      <SectionLabel icon={<IconShoppingCart size={14} />} onAdd={openShoppingSheet} addLabel="장바구니 추가">
        장바구니
      </SectionLabel>
      <button
        onClick={openShoppingSheet}
        className="flex flex-col gap-row pl-section-indent text-left"
      >
        {previewShopping.length === 0 ? (
          <p className={`text-[14px] ${mirror.muted}`}>장바구니가 비어있어요</p>
        ) : (
          previewShopping.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-sage" />
              <span className={`min-w-0 flex-1 truncate text-[16px] ${mirror.secondary}`}>
                {item.name}
              </span>
            </div>
          ))
        )}
        {restCount > 0 && (
          <span className={`self-end text-[14px] ${mirror.muted}`}>외 {restCount}개</span>
        )}
      </button>
    </div>
  );
}
