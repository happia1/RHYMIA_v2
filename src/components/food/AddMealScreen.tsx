"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { IconArrowLeft, IconFridge } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createMeal, updateMeal, addFridgeItem, deleteFridgeItem } from "@/app/(main)/food/actions";
import { MEAL_TAGS } from "@/lib/mealUtils";
import type { FridgeCategory, FridgeItem, Meal, MealType } from "@/types";

const MEAL_TYPES: MealType[] = ["집밥", "외식", "배달"];

const SUGGESTIONS: Record<MealType, string[]> = {
  집밥: ["된장찌개", "김치볶음밥", "계란말이", "제육볶음"],
  외식: ["돈까스", "파스타", "초밥", "고기구이"],
  배달: ["치킨", "피자", "짜장면", "떡볶이"],
};

const FRIDGE_CATEGORIES: { value: FridgeCategory; label: string }[] = [
  { value: "cold", label: "냉장" },
  { value: "frozen", label: "냉동" },
  { value: "room", label: "상온" },
];

export function AddMealScreen({
  workspaceId,
  defaultDate,
  fridgeItems,
  existingMeal,
}: {
  workspaceId: string;
  defaultDate: string;
  fridgeItems: FridgeItem[];
  existingMeal?: Meal;
}) {
  const [tag, setTag] = useState(existingMeal?.tag ?? MEAL_TAGS[0]);
  const [type, setType] = useState<MealType>(existingMeal?.type ?? "집밥");
  const [mainMenu, setMainMenu] = useState(existingMeal?.main_menu ?? "");
  const [place, setPlace] = useState(existingMeal?.place ?? "");
  const [reservationTime, setReservationTime] = useState(
    existingMeal?.reservation_time ?? ""
  );
  const [sides, setSides] = useState(existingMeal?.sides.join(", ") ?? "");
  const [memo, setMemo] = useState(existingMeal?.memo ?? "");
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const appendMenu = (item: string) => {
    setMainMenu((prev) => {
      const parts = prev
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.includes(item)) return prev;
      return [...parts, item].join(", ");
    });
  };

  const handleSubmit = () => {
    if (!mainMenu.trim()) return;
    const input = {
      date: defaultDate,
      tag,
      type,
      main_menu: mainMenu.trim(),
      sides: sides
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      place: type === "외식" ? place || null : null,
      reservation_time: type === "외식" ? reservationTime || null : null,
      memo: memo || null,
    };
    startTransition(() => {
      if (existingMeal) {
        updateMeal(existingMeal.id, input);
      } else {
        createMeal(workspaceId, input);
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream pb-10">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link
          href={existingMeal ? `/food/${existingMeal.id}` : "/food"}
          aria-label="뒤로가기"
        >
          <IconArrowLeft size={22} className="text-ink" />
        </Link>
        <h1 className="text-[15px] font-medium text-ink">
          {existingMeal ? "끼니 수정" : "끼니 추가"}
        </h1>
        <div className="w-[22px]" />
      </header>

      <div className="flex flex-col gap-6 px-4">
        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">끼니</span>
          <div className="flex gap-2 overflow-x-auto">
            {MEAL_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium ${
                  tag === t ? "bg-ink text-cream" : "bg-white text-stone"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">식사 유형</span>
          <div className="flex gap-2">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium ${
                  type === t ? "bg-ink text-cream" : "bg-white text-stone"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {type === "외식" && (
            <div className="mt-1 flex gap-2">
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="장소"
                className="h-11 flex-1 rounded-xl border border-border-light bg-white px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
              />
              <input
                value={reservationTime}
                onChange={(e) => setReservationTime(e.target.value)}
                placeholder="시간"
                className="h-11 w-24 rounded-xl border border-border-light bg-white px-3 text-[13px] text-ink placeholder:text-stone focus:outline-none"
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">메뉴 (쉼표로 여러 개)</span>
          <input
            value={mainMenu}
            onChange={(e) => setMainMenu(e.target.value)}
            placeholder="예: 된장찌개, 계란말이"
            className="h-11 rounded-xl border border-border-light bg-white px-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS[type].map((item) => (
              <button
                key={item}
                onClick={() => appendMenu(item)}
                className="rounded-full bg-white px-3 py-1.5 text-[12px] text-stone"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section>
          <button
            onClick={() => setFridgeOpen(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-ocean"
          >
            <IconFridge size={18} />
            현재 재고 확인
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">사이드 (선택)</span>
          <input
            value={sides}
            onChange={(e) => setSides(e.target.value)}
            placeholder="예: 김치, 나물"
            className="h-11 rounded-xl border border-border-light bg-white px-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
          />
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">메모 (선택)</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="자유롭게 적어보세요"
            className="rounded-xl border border-border-light bg-white p-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
          />
        </section>

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream"
        >
          {existingMeal ? "수정하기" : "등록하기"}
        </button>
      </div>

      <FridgeStockSheet
        open={fridgeOpen}
        onClose={() => setFridgeOpen(false)}
        workspaceId={workspaceId}
        items={fridgeItems}
      />
    </div>
  );
}

function FridgeStockSheet({
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

  const filtered = items.filter((i) => i.category === category);

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft("");
    startTransition(() => addFridgeItem(workspaceId, value, category));
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
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="재료 이름"
            className="h-11 flex-1 rounded-xl border border-border-light px-3 text-[14px] text-ink placeholder:text-stone focus:outline-none"
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
      </div>
    </BottomSheet>
  );
}
