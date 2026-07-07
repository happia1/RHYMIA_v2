"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { CheckToggle } from "@/components/ui/CheckToggle";
import {
  addShoppingItem,
  deleteShoppingItem,
  toggleShoppingPurchased,
} from "@/app/(main)/home/actions";
import { SHOPPING_DOT_SIZE } from "@/lib/uiTokens";
import type { ShoppingItem } from "@/types";

export function ShoppingList({
  workspaceId,
  items,
}: {
  workspaceId: string;
  items: ShoppingItem[];
}) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const active = items.filter((i) => !i.is_purchased);

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft("");
    startTransition(() => {
      addShoppingItem(workspaceId, value);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="살 것을 입력하세요"
          className="h-9 flex-1 rounded-xl border border-border-light px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
        />
        <button onClick={handleAdd} aria-label="추가" disabled={isPending}>
          <IconPlus size={20} className="text-stone" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {active.length === 0 && (
          <p className="text-[13px] text-stone">장바구니가 비어있어요</p>
        )}
        {active.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <CheckToggle
              checked={item.is_purchased}
              onChange={() =>
                startTransition(() => {
                  toggleShoppingPurchased(item.id, !item.is_purchased);
                })
              }
              size={SHOPPING_DOT_SIZE}
            />
            <span className="flex-1 truncate text-[14px] text-ink">{item.name}</span>
            <button
              onClick={() => startTransition(() => deleteShoppingItem(item.id))}
              aria-label="삭제"
            >
              <IconX size={16} className="text-stone" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
