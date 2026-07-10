"use client";

import { useState } from "react";
import Link from "next/link";
import { IconNote, IconShoppingCart } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { SectionLabel } from "@/components/home/SectionLabel";
import { AddPostSheet } from "@/components/home/BoardSection";
import { ShoppingQuickAddSheet } from "@/components/home/ShoppingQuickAddSheet";
import { useShoppingSheet } from "@/components/shopping/ShoppingSheetContext";
import type { Notice, ShoppingItem } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

function daysLeft(expireAt: string | null) {
  if (!expireAt) return null;
  return Math.ceil((new Date(expireAt).getTime() - Date.now()) / 86400000);
}

export function BoardPreview({
  workspaceId,
  currentUserId,
  stickers,
  shoppingItems,
  membersById,
}: {
  workspaceId: string;
  currentUserId: string;
  stickers: Notice[];
  shoppingItems: ShoppingItem[];
  membersById: Record<string, WorkspaceMemberInfo>;
}) {
  const [addingSticker, setAddingSticker] = useState(false);
  const [addingShopping, setAddingShopping] = useState(false);
  const { open: openShoppingSheet } = useShoppingSheet();

  const activeShopping = shoppingItems.filter((i) => !i.is_purchased);
  const previewShopping = activeShopping.slice(0, 4);
  const restCount = activeShopping.length - previewShopping.length;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="flex flex-col gap-row">
        <SectionLabel icon={<IconNote size={14} />} onAdd={() => setAddingSticker(true)} addLabel="하고싶은 말 작성">
          하고싶은 말
        </SectionLabel>
        <Link href="/board" className="flex flex-col gap-row pl-section-indent">
          {stickers.length === 0 && (
            <p className={`text-[12px] ${mirror.muted}`}>등록된 하고싶은 말이 없어요</p>
          )}
          {stickers.slice(0, 3).map((s) => {
            const author = membersById[s.created_by ?? ""];
            const left = daysLeft(s.expire_at);
            return (
              <div key={s.id} className="flex flex-col gap-0.5">
                <span className={`text-[10px] ${mirror.muted}`}>
                  {author?.display_name ?? "가족"}
                </span>
                <span className={`truncate text-[13px] ${mirror.secondary}`}>{s.content}</span>
                {left !== null && (
                  <span className={`text-[10px] ${mirror.muted}`}>D-{Math.max(left, 0)}</span>
                )}
              </div>
            );
          })}
        </Link>
      </div>

      <div className="flex flex-col gap-row">
        <SectionLabel
          icon={<IconShoppingCart size={14} />}
          onAdd={() => setAddingShopping(true)}
          addLabel="장바구니 추가"
        >
          장바구니
        </SectionLabel>
        <button
          onClick={openShoppingSheet}
          className="flex flex-col gap-row pl-section-indent text-left"
        >
          {previewShopping.length === 0 ? (
            <p className={`text-[12px] ${mirror.muted}`}>장바구니가 비어있어요</p>
          ) : (
            previewShopping.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-sage" />
                <span className={`min-w-0 flex-1 truncate text-[13px] ${mirror.secondary}`}>
                  {item.name}
                </span>
              </div>
            ))
          )}
          {restCount > 0 && (
            <span className={`text-[12px] ${mirror.muted}`}>외 {restCount}개</span>
          )}
        </button>
      </div>

      <AddPostSheet
        open={addingSticker}
        onClose={() => setAddingSticker(false)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        fixedType="sticky"
      />
      <ShoppingQuickAddSheet
        open={addingShopping}
        onClose={() => setAddingShopping(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
