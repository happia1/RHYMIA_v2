"use client";

import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createMeal } from "@/app/(main)/food/actions";
import { MEAL_TAGS } from "@/lib/mealUtils";
import type { MealType } from "@/types";

const MEAL_TYPES: MealType[] = ["집밥", "외식", "배달"];

export function MealQuickAddSheet({
  open,
  onClose,
  workspaceId,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  defaultDate: string;
}) {
  const { showToast } = useToast();
  const [tag, setTag] = useState<string>(MEAL_TAGS[0]);
  const [type, setType] = useState<MealType>("집밥");
  const [mainMenu, setMainMenu] = useState("");
  const [sides, setSides] = useState("");
  const [memo, setMemo] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setTag(MEAL_TAGS[0]);
    setType("집밥");
    setMainMenu("");
    setSides("");
    setMemo("");
  };

  const handleSubmit = () => {
    if (!mainMenu.trim()) return;
    startTransition(async () => {
      await createMeal(workspaceId, {
        date: defaultDate,
        tag,
        type,
        main_menu: mainMenu.trim(),
        sides: sides
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        memo: memo || null,
      });
      showToast("끼니가 등록되었습니다.");
      reset();
      onClose();
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">끼니 추가</h2>

        <div className="flex flex-wrap gap-2">
          {MEAL_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                tag === t ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                type === t ? "bg-ink text-cream" : "bg-cream text-stone"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <Input
          value={mainMenu}
          onChange={(e) => setMainMenu(e.target.value)}
          placeholder="메뉴 (예: 된장찌개, 계란말이)"
          className="h-11 rounded-xl px-3 text-[14px]"
        />
        <Input
          value={sides}
          onChange={(e) => setSides(e.target.value)}
          placeholder="사이드 (선택, 쉼표로 구분)"
          className="h-11 rounded-xl px-3 text-[14px]"
        />
        <Textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={2}
          className="rounded-xl p-3 text-[13px]"
        />

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream disabled:opacity-50"
        >
          등록하기
        </button>
      </div>
    </BottomSheet>
  );
}
