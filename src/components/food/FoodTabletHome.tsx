"use client";

import { useState } from "react";
import Link from "next/link";
import { IconToolsKitchen2 } from "@tabler/icons-react";
import { toDateStr, WEEKDAY_LABEL } from "@/lib/date";
import { tagOrderIndex } from "@/lib/mealUtils";
import { mirror } from "@/lib/homeTheme";
import { useToast } from "@/components/ui/Toast";
import { MealDecisionSheet, type Mode as DecisionMode } from "@/components/food/MealDecisionSheet";
import { RecipeDetailSheet } from "@/components/food/RecipeDetailSheet";
import { RecipeNoteSheet } from "@/components/food/RecipeNoteSheet";
import { DECISION_MODES } from "@/components/food/SuggestionSection";
import { FRIDGE_CATEGORIES } from "@/components/food/FridgeStockSheet";
import { addFridgeItem, deleteFridgeItem } from "@/app/(main)/food/actions";
import { buildCandidatePool } from "@/lib/mealUtils";
import { ShoppingListPanel } from "@/components/shopping/ShoppingListPanel";
import type { MealRow } from "@/components/food/MealListSection";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";
import type { FridgeCategory, FridgeItem, MealVote, ShoppingItem } from "@/types";

const ZONE_ICON: Record<FridgeCategory, string> = { frozen: "❄️", cold: "🧊", room: "🧺" };

function TabletWeekStrip({
  weekDates,
  datesWithSchedule,
}: {
  weekDates: string[];
  datesWithSchedule: Set<string>;
}) {
  const todayStr = toDateStr(new Date());
  return (
    <div className={`grid grid-cols-7 gap-1 border-b pb-3 ${mirror.hairline}`}>
      {weekDates.map((date) => {
        const d = new Date(`${date}T00:00:00.000Z`);
        const day = d.getUTCDate();
        const isToday = date === todayStr;
        return (
          <Link
            key={date}
            href={`/schedule?view=day&date=${date}`}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span className={`text-[9px] ${mirror.muted}`}>{WEEKDAY_LABEL[d.getUTCDay()]}</span>
            <span className={`text-[12.5px] ${isToday ? `font-bold ${mirror.primary}` : mirror.secondary}`}>
              {day}
            </span>
            <span
              className={`h-[3.5px] w-[3.5px] rounded-full ${
                datesWithSchedule.has(date) ? "bg-honey" : "bg-transparent"
              }`}
            />
          </Link>
        );
      })}
    </div>
  );
}

function TabletMealList({ meals }: { meals: MealRow[] }) {
  const sorted = [...meals].sort((a, b) => tagOrderIndex(a.tag) - tagOrderIndex(b.tag));
  return (
    <div className={`flex flex-col gap-1.5 border-b pb-3 ${mirror.hairline}`}>
      <span className={mirror.label}>오늘 식단</span>
      {sorted.length === 0 && <p className={`text-[12.5px] ${mirror.muted}`}>등록된 끼니가 없어요</p>}
      {sorted.map((meal) => (
        <Link key={meal.id} href={`/food/${meal.id}`} className="flex items-center justify-between gap-2 py-0.5">
          <span className={`shrink-0 text-[11.5px] ${mirror.muted}`}>{meal.tag}</span>
          <span className={`min-w-0 flex-1 truncate text-right text-[13px] ${mirror.primary}`}>
            {meal.main_menu}
          </span>
        </Link>
      ))}
    </div>
  );
}

function TabletSuggestionChips({
  frequentMenus,
  trackingDays,
  onOpenDecision,
}: {
  frequentMenus: string[];
  trackingDays: number;
  onOpenDecision: (mode: DecisionMode) => void;
}) {
  const unlocked = trackingDays >= 7;
  return (
    <div className={`flex flex-col gap-1.5 border-b pb-3 ${mirror.hairline}`}>
      <span className={mirror.label}>오늘의 제안</span>
      <p className={`text-[12.5px] leading-loose ${mirror.secondary}`}>
        자주 찾는 메뉴{" "}
        <span className={mirror.muted}>
          {unlocked ? frequentMenus[0] ?? "아직 기록이 없어요" : `데이터 쌓는 중 (${trackingDays}/7일)`}
        </span>
        <br />
        {DECISION_MODES.map((m, i) => (
          <span key={m.mode}>
            {i > 0 && <span className={mirror.muted}> · </span>}
            <button
              onClick={() => onOpenDecision(m.mode)}
              className={i === 0 ? "font-medium text-honey" : mirror.muted}
            >
              {m.label}
            </button>
          </span>
        ))}
      </p>
    </div>
  );
}

function TabletRecipeSection({
  recipeEnabled,
  recommendedRecipe,
  recipeNotesCount,
  onOpenRecipe,
  onOpenNotes,
}: {
  recipeEnabled: boolean;
  recommendedRecipe: NormalizedRecipe | null;
  recipeNotesCount: number;
  onOpenRecipe: () => void;
  onOpenNotes: () => void;
}) {
  const body = !recipeEnabled ? "준비 중" : recommendedRecipe ? recommendedRecipe.name : "잠시 후 다시 시도해주세요";
  return (
    <div className="flex flex-col gap-1.5">
      <span className={mirror.label}>레시피</span>
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenRecipe}
          disabled={!recipeEnabled || !recommendedRecipe}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream">
            {recommendedRecipe?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recommendedRecipe.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <IconToolsKitchen2 size={20} className={mirror.muted} />
            )}
          </div>
          <span className="flex min-w-0 flex-col">
            <span className={`text-[10px] ${mirror.muted}`}>오늘의 추천</span>
            <span className={`truncate text-[13px] font-semibold ${mirror.primary}`}>{body}</span>
          </span>
        </button>
        <button onClick={onOpenNotes} className="shrink-0 text-[11px] font-medium text-honey">
          레시피 노트 {recipeNotesCount} ›
        </button>
      </div>
    </div>
  );
}

function FridgeCompartment({
  zone,
  label,
  items,
  collapsed,
  onDelete,
  onAdd,
}: {
  zone: FridgeCategory;
  label: string;
  items: FridgeItem[];
  collapsed: boolean;
  onDelete: (id: string) => void;
  onAdd: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const value = draft.trim();
    setDraft("");
    setAdding(false);
    if (value) onAdd(value);
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${collapsed ? "p-2" : "p-3"}`}>
      <p className={`shrink-0 text-[10px] ${mirror.muted}`}>
        {ZONE_ICON[zone]} {label} · {items.length}
      </p>
      {!collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-1.5 border-t py-1 ${mirror.hairline}`}
              >
                <span className={`min-w-0 flex-1 truncate text-[12.5px] ${mirror.primary}`}>{item.name}</span>
                <button
                  onClick={() => onDelete(item.id)}
                  aria-label={`${item.name} 삭제`}
                  className={`shrink-0 px-0.5 text-[10px] ${mirror.muted}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onBlur={submit}
              placeholder="재료명"
              className={`mt-1.5 shrink-0 border-b bg-transparent text-[11px] outline-none ${mirror.hairline} ${mirror.primary}`}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className={`mt-1.5 shrink-0 self-start text-[11px] ${mirror.muted}`}
            >
              + 추가
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** 태블릿 전용 식탁 탭 레이아웃 — fridge_tablet_suite.jsx 스펙. 부모(food/page.tsx)의
 * DeviceLayoutSwitch가 이미 모바일/태블릿을 갈라놓기 때문에 이 컴포넌트 자체는 별도
 * 미디어쿼리 없이 항상 렌더된 그대로 보이면 된다. 좌열은 전부
 * 기존 위젯이 쓰는 데이터/서버 액션을 그대로 재사용(주간 스트립만 신규 — 끼니가 아니라
 * 일정 유무를 점으로 보여주고 탭하면 일정 탭으로 나간다). 우열은 냉장고 묘사 + 장바구니
 * 아코디언(기본 8:2, 장바구니 탭 시 4:6) — 펼친 장바구니는 ShoppingListPanel을 그대로
 * 인라인으로 꽂아 넣는다(모바일 전역 시트와 동일 컴포넌트). */
export function FoodTabletHome({
  workspaceId,
  selectedDate,
  weekDates,
  datesWithSchedule,
  dayMeals,
  frequentMenus,
  trackingDays,
  blockingVote,
  recommendedRecipe,
  recipeEnabled,
  recipeNotesCount,
  fridgeItems,
  cartItems,
}: {
  workspaceId: string;
  selectedDate: string;
  weekDates: string[];
  datesWithSchedule: Set<string>;
  dayMeals: MealRow[];
  frequentMenus: string[];
  trackingDays: number;
  blockingVote: MealVote | null;
  recommendedRecipe: NormalizedRecipe | null;
  recipeEnabled: boolean;
  recipeNotesCount: number;
  fridgeItems: FridgeItem[];
  cartItems: ShoppingItem[];
}) {
  const { showToast } = useToast();
  const [items, setItems] = useState(fridgeItems);
  const [expanded, setExpanded] = useState<"fridge" | "cart">("fridge");
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionMode, setDecisionMode] = useState<DecisionMode>("roulette");
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const fridgeOpen = expanded === "fridge";
  const cartActive = cartItems.filter((c) => !c.expense_id && !c.is_purchased);

  const openDecision = (mode: DecisionMode) => {
    setDecisionMode(mode);
    setDecisionOpen(true);
  };

  const handleAddFridgeItem = (zone: FridgeCategory, name: string) => {
    const tempId = `temp-${Date.now()}`;
    setItems((prev) => [
      { id: tempId, workspace_id: workspaceId, name, category: zone, added_by: null, created_at: new Date().toISOString() },
      ...prev,
    ]);
    addFridgeItem(workspaceId, name, zone).catch(() => {
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      showToast("재료 추가에 실패했어요.");
    });
  };

  const handleDeleteFridgeItem = (id: string) => {
    const removed = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    deleteFridgeItem(id).catch(() => {
      if (removed) setItems((prev) => [removed, ...prev]);
      showToast("삭제에 실패했어요.");
    });
  };

  const byZone = (zone: FridgeCategory) => items.filter((i) => i.category === zone);

  return (
    <>
      <div className="flex h-full gap-8">
        <div className="flex w-[42%] flex-col gap-3 overflow-y-auto">
          <TabletWeekStrip weekDates={weekDates} datesWithSchedule={datesWithSchedule} />
          <TabletMealList meals={dayMeals} />
          <TabletSuggestionChips
            frequentMenus={frequentMenus}
            trackingDays={trackingDays}
            onOpenDecision={openDecision}
          />
          <TabletRecipeSection
            recipeEnabled={recipeEnabled}
            recommendedRecipe={recommendedRecipe}
            recipeNotesCount={recipeNotesCount}
            onOpenRecipe={() => setRecipeOpen(true)}
            onOpenNotes={() => setNotesOpen(true)}
          />
        </div>

        <div className={`w-px shrink-0 ${mirror.hairlineBg}`} />

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* 냉장고 */}
          <div
            onClick={() => setExpanded("fridge")}
            style={{ flexGrow: fridgeOpen ? 8 : 4, flexBasis: 0 }}
            className="flex min-h-0 cursor-pointer flex-col transition-[flex-grow] duration-300 ease-out"
          >
            <div className="flex shrink-0 items-center justify-between pb-2">
              <span className={mirror.label}>집에 뭐 있지</span>
              {!fridgeOpen && <span className={`text-[11px] ${mirror.muted}`}>▸ 펼치기</span>}
            </div>
            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${mirror.hairline}`}>
              <div className="flex min-h-0 flex-[1.4]">
                <FridgeCompartment
                  zone="frozen"
                  label={FRIDGE_CATEGORIES.find((c) => c.value === "frozen")!.label}
                  items={byZone("frozen")}
                  collapsed={!fridgeOpen}
                  onDelete={handleDeleteFridgeItem}
                  onAdd={(name) => handleAddFridgeItem("frozen", name)}
                />
                <div className={`w-px shrink-0 ${mirror.hairlineBg}`} />
                <FridgeCompartment
                  zone="cold"
                  label={FRIDGE_CATEGORIES.find((c) => c.value === "cold")!.label}
                  items={byZone("cold")}
                  collapsed={!fridgeOpen}
                  onDelete={handleDeleteFridgeItem}
                  onAdd={(name) => handleAddFridgeItem("cold", name)}
                />
              </div>
              <div className={`min-h-0 flex-1 border-t ${mirror.hairline}`}>
                <FridgeCompartment
                  zone="room"
                  label={FRIDGE_CATEGORIES.find((c) => c.value === "room")!.label}
                  items={byZone("room")}
                  collapsed={!fridgeOpen}
                  onDelete={handleDeleteFridgeItem}
                  onAdd={(name) => handleAddFridgeItem("room", name)}
                />
              </div>
            </div>
          </div>

          {/* 장바구니 */}
          <div
            onClick={() => setExpanded("cart")}
            style={{ flexGrow: fridgeOpen ? 2 : 6, flexBasis: 0 }}
            className="flex min-h-0 cursor-pointer flex-col overflow-hidden transition-[flex-grow] duration-300 ease-out"
          >
            <div className="flex shrink-0 items-center justify-between pb-2">
              <span className={mirror.label}>뭐 사야하지</span>
              {fridgeOpen && <span className={`text-[11px] ${mirror.muted}`}>▸ 펼치기</span>}
            </div>
            {fridgeOpen ? (
              <div className="flex items-center gap-4 overflow-hidden">
                {cartActive.slice(0, 3).map((c) => (
                  <span key={c.id} className={`flex shrink-0 items-center gap-1.5 text-[12.5px] ${mirror.primary}`}>
                    <span className="h-1 w-1 shrink-0 rounded-full bg-sage" />
                    {c.name}
                  </span>
                ))}
                {cartActive.length > 3 && (
                  <span className={`shrink-0 text-[11.5px] ${mirror.muted}`}>외 {cartActive.length - 3}개</span>
                )}
                {cartActive.length === 0 && (
                  <span className={`text-[12px] ${mirror.muted}`}>장바구니가 비어있어요</span>
                )}
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} className="min-h-0 flex-1 overflow-y-auto">
                <ShoppingListPanel workspaceId={workspaceId} />
              </div>
            )}
          </div>
        </div>
      </div>

      <MealDecisionSheet
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        workspaceId={workspaceId}
        selectedDate={selectedDate}
        candidatePool={buildCandidatePool(frequentMenus)}
        activeVote={blockingVote}
        initialMode={decisionMode}
      />

      <RecipeDetailSheet
        recipe={recommendedRecipe}
        open={recipeOpen}
        onClose={() => setRecipeOpen(false)}
        selectedDate={selectedDate}
      />

      <RecipeNoteSheet
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        workspaceId={workspaceId}
        selectedDate={selectedDate}
      />
    </>
  );
}
