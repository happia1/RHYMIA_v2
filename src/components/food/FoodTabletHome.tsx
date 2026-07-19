"use client";

import { useState } from "react";
import Link from "next/link";
import { IconFridge, IconShoppingCart } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { useDeviceLayout } from "@/lib/useDeviceLayout";
import { useToast } from "@/components/ui/Toast";
import { WeekCalendar } from "@/components/food/WeekCalendar";
import { MealEmptyState } from "@/components/food/MealEmptyState";
import { MealListSection, type MealRow } from "@/components/food/MealListSection";
import { MealNutritionSummary } from "@/components/food/MealNutritionSummary";
import { SuggestionSection } from "@/components/food/SuggestionSection";
import { RecipeSection } from "@/components/food/RecipeSection";
import { FRIDGE_CATEGORIES } from "@/components/food/FridgeStockSheet";
import { ShoppingTabbedPanel } from "@/components/shopping/ShoppingTabbedPanel";
import { addFridgeItem, deleteFridgeItem } from "@/app/(main)/food/actions";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";
import type { FridgeCategory, FridgeItem, MealVote, ShoppingItem } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

const ZONE_ICON: Record<FridgeCategory, string> = { frozen: "❄️", cold: "🧊", room: "🧺" };
// 아코디언이 접혔을 때도 칸이 통째로 비어 보이지 않게, 칸별로 이만큼만 미리 보여주고
// 나머지는 "외 N개"로 요약한다.
const COLLAPSED_PREVIEW_COUNT = 2;

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

  const previewItems = items.slice(0, COLLAPSED_PREVIEW_COUNT);
  const restCount = items.length - previewItems.length;

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${collapsed ? "p-2" : "p-3"}`}>
      <p className={`shrink-0 text-[12px] ${mirror.muted}`}>
        {ZONE_ICON[zone]} {label} · {items.length}
      </p>
      {collapsed ? (
        // 접힌 상태에서도 칸이 통째로 비어 보이지 않게 첫 몇 개 + "외 N개" 요약만 남긴다.
        <div className="mt-1 min-h-0 flex-1 overflow-hidden">
          {previewItems.length === 0 ? (
            <p className={`truncate text-[13px] ${mirror.muted}`}>비어있어요</p>
          ) : (
            <>
              {previewItems.map((item) => (
                <p key={item.id} className={`truncate text-[13px] ${mirror.secondary}`}>
                  {item.name}
                </p>
              ))}
              {restCount > 0 && (
                <p className={`truncate text-[12px] ${mirror.muted}`}>외 {restCount}개</p>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-1.5 border-t py-1 ${mirror.hairline}`}
              >
                <span className={`min-w-0 flex-1 truncate text-[15px] ${mirror.primary}`}>{item.name}</span>
                <button
                  onClick={() => onDelete(item.id)}
                  aria-label={`${item.name} 삭제`}
                  className={`shrink-0 px-0.5 text-[12px] ${mirror.muted}`}
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
              className={`mt-1.5 shrink-0 border-b bg-transparent text-[13px] outline-none ${mirror.hairline} ${mirror.primary}`}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className={`mt-1.5 shrink-0 self-start text-[13px] ${mirror.muted}`}
            >
              + 추가
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** 태블릿 전용 식탁 탭 레이아웃 — fridge_tablet_suite.jsx 스펙. 좌열은 모바일 식탁 탭과
 * 완전히 같은 컴포넌트를 그대로 렌더한다(주간 스트립=WeekCalendar, 끼니 카드
 * 리스트=MealListSection, 오늘의 제안=SuggestionSection, 레시피=RecipeSection — 전부
 * 태블릿 전용 재구현 없이 모바일과 동일한 데이터/컴포넌트 재사용). 우열은 가로/세로 방향에
 * 따라 구조가 다르다 — 가로: 상단 탭([집에 뭐 있지 | 뭐 사야하지])으로 선택된 쪽이 전체
 * 높이를 씀. 세로: 기존 아코디언(기본 8:2, 장바구니 탭 시 4:6) — 펼친 장바구니는
 * ShoppingTabbedPanel(장볼 것/기록 탭 전체)을 그대로 인라인으로 꽂아 넣는다(모바일 전역
 * 시트와 동일 컴포넌트). */
export function FoodTabletHome({
  workspaceId,
  selectedDate,
  weekDates,
  datesWithMeals,
  dayMeals,
  members,
  currentUserId,
  nutritionEnabled,
  frequentMenus,
  trackingDays,
  blockingVote,
  recommendedRecipe,
  recipeEnabled,
  recipeNotesCount,
  blogSearchEnabled,
  autoOpenRecipeSearch = false,
  fridgeItems,
  cartItems,
}: {
  workspaceId: string;
  selectedDate: string;
  weekDates: string[];
  datesWithMeals: Set<string>;
  dayMeals: MealRow[];
  members: WorkspaceMemberInfo[];
  currentUserId: string;
  nutritionEnabled: boolean;
  frequentMenus: string[];
  trackingDays: number;
  blockingVote: MealVote | null;
  recommendedRecipe: NormalizedRecipe | null;
  recipeEnabled: boolean;
  recipeNotesCount: number;
  blogSearchEnabled: boolean;
  autoOpenRecipeSearch?: boolean;
  fridgeItems: FridgeItem[];
  cartItems: ShoppingItem[];
}) {
  const { layout } = useDeviceLayout();
  const isLandscape = layout === "tablet-landscape";
  const { showToast } = useToast();
  const [items, setItems] = useState(fridgeItems);
  // 세로(아코디언)에서는 "펼쳐진 쪽", 가로(상단 탭)에서는 "선택된 탭" — 둘 다 같은
  // fridge/cart 선택 상태라 변수 하나를 공유한다.
  const [expanded, setExpanded] = useState<"fridge" | "cart">("fridge");

  const fridgeOpen = expanded === "fridge";
  const cartActive = cartItems.filter((c) => !c.expense_id && !c.is_purchased);

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

  const fridgeCompartments = (collapsed: boolean) => (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${mirror.hairline}`}>
      <div className="flex min-h-0 flex-[1.4]">
        <FridgeCompartment
          zone="frozen"
          label={FRIDGE_CATEGORIES.find((c) => c.value === "frozen")!.label}
          items={byZone("frozen")}
          collapsed={collapsed}
          onDelete={handleDeleteFridgeItem}
          onAdd={(name) => handleAddFridgeItem("frozen", name)}
        />
        <div className={`w-px shrink-0 ${mirror.hairlineBg}`} />
        <FridgeCompartment
          zone="cold"
          label={FRIDGE_CATEGORIES.find((c) => c.value === "cold")!.label}
          items={byZone("cold")}
          collapsed={collapsed}
          onDelete={handleDeleteFridgeItem}
          onAdd={(name) => handleAddFridgeItem("cold", name)}
        />
      </div>
      <div className={`min-h-0 flex-1 border-t ${mirror.hairline}`}>
        <FridgeCompartment
          zone="room"
          label={FRIDGE_CATEGORIES.find((c) => c.value === "room")!.label}
          items={byZone("room")}
          collapsed={collapsed}
          onDelete={handleDeleteFridgeItem}
          onAdd={(name) => handleAddFridgeItem("room", name)}
        />
      </div>
    </div>
  );

  return (
      <div className="flex h-full gap-8">
        <div className="flex w-[42%] flex-col gap-4 overflow-y-auto">
          <WeekCalendar weekDates={weekDates} selectedDate={selectedDate} datesWithMeals={datesWithMeals} />

          {dayMeals.length === 0 ? (
            <MealEmptyState
              workspaceId={workspaceId}
              selectedDate={selectedDate}
              frequentMenus={frequentMenus}
              activeVote={blockingVote}
            />
          ) : (
            <>
              <MealListSection
                meals={dayMeals}
                members={members}
                currentUserId={currentUserId}
                nutritionEnabled={nutritionEnabled}
              />
              <div className="flex items-center gap-2 border-t border-border-light pt-2.5">
                {nutritionEnabled && <MealNutritionSummary meals={dayMeals} />}
                <Link
                  href={`/food/add?date=${selectedDate}`}
                  className="ml-auto shrink-0 text-[13px] font-medium text-honey"
                >
                  + 끼니 추가
                </Link>
              </div>
            </>
          )}

          <SuggestionSection
            workspaceId={workspaceId}
            selectedDate={selectedDate}
            frequentMenus={frequentMenus}
            trackingDays={trackingDays}
            activeVote={blockingVote}
          />

          <RecipeSection
            workspaceId={workspaceId}
            selectedDate={selectedDate}
            recipeEnabled={recipeEnabled}
            recommendedRecipe={recommendedRecipe}
            recipeNotesCount={recipeNotesCount}
            blogSearchEnabled={blogSearchEnabled}
            autoOpenSearch={autoOpenRecipeSearch}
          />
        </div>

        <div className={`w-px shrink-0 ${mirror.hairlineBg}`} />

        {isLandscape ? (
          // 가로: 아코디언 대신 상단 탭 — 선택된 탭이 우측 전체 높이를 그대로 쓴다(뭐
          // 사야하지 탭의 기록 달력이 아코디언 압축으로 잘리지 않게 하려는 목적).
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setExpanded("fridge")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-medium ${
                  fridgeOpen ? "bg-honey/15 text-honey" : mirror.muted
                }`}
              >
                <IconFridge size={14} />
                집에 뭐 있지
              </button>
              <button
                onClick={() => setExpanded("cart")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-medium ${
                  !fridgeOpen ? "bg-honey/15 text-honey" : mirror.muted
                }`}
              >
                <IconShoppingCart size={14} />
                뭐 사야하지
              </button>
            </div>

            {fridgeOpen ? (
              fridgeCompartments(false)
            ) : (
              <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-3 ${mirror.hairline}`}>
                <ShoppingTabbedPanel workspaceId={workspaceId} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* 냉장고 */}
            <div
              onClick={() => setExpanded("fridge")}
              style={{ flexGrow: fridgeOpen ? 8 : 4, flexBasis: 0 }}
              className="flex min-h-0 cursor-pointer flex-col transition-[flex-grow] duration-300 ease-out"
            >
              <div className="flex shrink-0 items-center justify-between pb-2">
                <div className={`flex items-center gap-1.5 ${mirror.label}`}>
                  <IconFridge size={14} />
                  <span>집에 뭐 있지</span>
                </div>
                {!fridgeOpen && <span className={`text-[13px] ${mirror.muted}`}>▸ 펼치기</span>}
              </div>
              {fridgeCompartments(!fridgeOpen)}
            </div>

            {/* 장바구니 — 집에 뭐 있지와 동일한 라운드 테두리 컨테이너 적용 */}
            <div
              onClick={() => setExpanded("cart")}
              style={{ flexGrow: fridgeOpen ? 2 : 6, flexBasis: 0 }}
              className="flex min-h-0 cursor-pointer flex-col overflow-hidden transition-[flex-grow] duration-300 ease-out"
            >
              <div className="flex shrink-0 items-center justify-between pb-2">
                <div className={`flex items-center gap-1.5 ${mirror.label}`}>
                  <IconShoppingCart size={14} />
                  <span>뭐 사야하지</span>
                </div>
                {fridgeOpen && <span className={`text-[13px] ${mirror.muted}`}>▸ 펼치기</span>}
              </div>
              <div
                className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${mirror.hairline} ${
                  fridgeOpen ? "p-2" : "p-3"
                }`}
              >
                {fridgeOpen ? (
                  // 접힘 요약 규칙(첫 2개 + 외 N개)을 냉장고 칸과 동일하게 맞춘다.
                  <div className="flex items-center gap-3 overflow-hidden">
                    {cartActive.slice(0, COLLAPSED_PREVIEW_COUNT).map((c) => (
                      <span key={c.id} className={`flex shrink-0 items-center gap-1.5 text-[13px] ${mirror.secondary}`}>
                        <span className="h-1 w-1 shrink-0 rounded-full bg-sage" />
                        {c.name}
                      </span>
                    ))}
                    {cartActive.length > COLLAPSED_PREVIEW_COUNT && (
                      <span className={`shrink-0 text-[12px] ${mirror.muted}`}>
                        외 {cartActive.length - COLLAPSED_PREVIEW_COUNT}개
                      </span>
                    )}
                    {cartActive.length === 0 && (
                      <span className={`text-[13px] ${mirror.muted}`}>장바구니가 비어있어요</span>
                    )}
                  </div>
                ) : (
                  <div onClick={(e) => e.stopPropagation()} className="flex min-h-0 flex-1 flex-col">
                    <ShoppingTabbedPanel workspaceId={workspaceId} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
