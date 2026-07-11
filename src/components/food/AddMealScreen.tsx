"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { IconArrowLeft, IconFridge, IconCamera, IconLoader2, IconX } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { mirror } from "@/lib/homeTheme";
import { createClient } from "@/lib/supabase/client";
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

function TextToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-[13px] font-medium ${
        active ? "text-ink" : "text-[var(--text-muted)]"
      }`}
    >
      {label}
    </button>
  );
}

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
  const { showToast } = useToast();
  const [tag, setTag] = useState(existingMeal?.tag ?? MEAL_TAGS[0]);
  const [type, setType] = useState<MealType>(existingMeal?.type ?? "집밥");
  const [mainMenu, setMainMenu] = useState(existingMeal?.main_menu ?? "");
  const [place, setPlace] = useState(existingMeal?.place ?? "");
  const [reservationTime, setReservationTime] = useState(
    existingMeal?.reservation_time ?? ""
  );
  const [memo, setMemo] = useState(existingMeal?.memo ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(existingMeal?.image_url ?? null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    setIsUploadingImage(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("meal-images").upload(path, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from("meal-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch {
      showToast("이미지 업로드에 실패했어요.");
    } finally {
      setIsUploadingImage(false);
    }
  };

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
      // 사이드 전용 입력 필드는 제거됨(메뉴 쉼표 입력으로 통합) — 수정 시 기존 값은 그대로 보존, 신규 등록은 항상 빈 배열
      sides: existingMeal?.sides ?? [],
      place: type === "외식" ? place || null : null,
      reservation_time: type === "외식" ? reservationTime || null : null,
      memo: memo || null,
      image_url: imageUrl,
    };
    startTransition(async () => {
      if (existingMeal) {
        const result = await updateMeal(existingMeal.id, input);
        if (result && !result.ok) {
          showToast(result.message);
        }
      } else {
        await createMeal(workspaceId, input);
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
          <span className={mirror.label}>끼니</span>
          <div className="flex gap-4 overflow-x-auto">
            {MEAL_TAGS.map((t) => (
              <TextToggle key={t} label={t} active={tag === t} onClick={() => setTag(t)} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className={mirror.label}>식사 유형</span>
          <div className="flex gap-4">
            {MEAL_TYPES.map((t) => (
              <TextToggle key={t} label={t} active={type === t} onClick={() => setType(t)} />
            ))}
          </div>
          {type === "외식" && (
            <div className="mt-1 flex gap-4">
              <Input
                variant="underline"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="장소"
                className="h-10 flex-1 px-0 text-[13px]"
              />
              <Input
                variant="underline"
                value={reservationTime}
                onChange={(e) => setReservationTime(e.target.value)}
                placeholder="시간"
                className="h-10 w-20 px-0 text-[13px]"
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <span className={mirror.label}>메뉴 (쉼표로 여러 개)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => imageFileInputRef.current?.click()}
              disabled={isUploadingImage}
              aria-label={imageUrl ? "이미지 변경" : "이미지 삽입"}
              className="flex h-7 w-7 shrink-0 items-center justify-center"
            >
              {isUploadingImage ? (
                <IconLoader2 size={18} className="animate-spin text-honey" />
              ) : imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
              ) : (
                <IconCamera size={18} className="text-[var(--text-muted)]" />
              )}
            </button>
            <Input
              variant="underline"
              value={mainMenu}
              onChange={(e) => setMainMenu(e.target.value)}
              placeholder="예: 된장찌개, 계란말이"
              className="h-11 flex-1 px-0 text-[14px]"
            />
            {imageUrl && (
              <button onClick={() => setImageUrl(null)} aria-label="이미지 제거" className="shrink-0">
                <IconX size={16} className="text-[var(--text-muted)]" />
              </button>
            )}
          </div>
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelected}
          />
          <div className="flex flex-wrap gap-3">
            {SUGGESTIONS[type].map((item) => (
              <button
                key={item}
                onClick={() => appendMenu(item)}
                className="text-[12px] font-medium text-[var(--text-muted)]"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section>
          <button
            onClick={() => setFridgeOpen(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-honey"
          >
            <IconFridge size={18} />
            현재 재고 확인
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <span className={mirror.label}>메모 (선택)</span>
          <Textarea
            variant="underline"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="자유롭게 적어보세요"
            className="px-0 py-2 text-[14px]"
          />
        </section>

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex h-12 items-center justify-center rounded-2xl bg-btn-surface text-[15px] font-medium text-btn-surface-text"
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
      </div>
    </BottomSheet>
  );
}
