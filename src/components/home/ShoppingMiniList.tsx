"use client";

import { useTransition } from "react";
import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { toggleShoppingPurchased } from "@/app/(main)/home/actions";
import type { ShoppingItem } from "@/types";

export function ShoppingMiniList({ items }: { items: ShoppingItem[] }) {
  const [, startTransition] = useTransition();

  const active = items.filter((i) => !i.is_purchased);
  const preview = active.slice(0, 4);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4">
      {active.length === 0 ? (
        <p className="text-[13px] text-stone">장바구니가 비어있어요</p>
      ) : (
        <div className="flex flex-col gap-2">
          {preview.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <CheckToggle
                checked={item.is_purchased}
                onChange={() =>
                  startTransition(() => {
                    toggleShoppingPurchased(item.id, !item.is_purchased);
                  })
                }
                size={10}
              />
              <span className="flex-1 truncate text-[14px] text-ink">{item.name}</span>
            </div>
          ))}
        </div>
      )}

      {active.length > 4 && (
        <Link
          href="/board"
          className="flex items-center gap-0.5 self-start text-[12px] font-medium text-stone"
        >
          더보기
          <IconChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}
