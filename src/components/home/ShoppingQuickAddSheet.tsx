"use client";

import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { addShoppingItem } from "@/app/(main)/home/actions";

export function ShoppingQuickAddSheet({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    const value = draft.trim();
    if (!value) return;
    startTransition(async () => {
      await addShoppingItem(workspaceId, value);
      setDraft("");
      onClose();
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setDraft("");
        onClose();
      }}
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">장바구니 추가</h2>
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="살 것을 입력하세요"
          className="h-11 rounded-xl px-3 text-[14px]"
        />
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream disabled:opacity-50"
        >
          추가하기
        </button>
      </div>
    </BottomSheet>
  );
}
