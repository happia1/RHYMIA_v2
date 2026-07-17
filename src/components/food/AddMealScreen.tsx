"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconFridge,
  IconCamera,
  IconPhoto,
  IconBrandYoutube,
  IconLink,
  IconSearch,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { mirror } from "@/lib/homeTheme";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { fetchYoutubeOembed, youtubeThumbnailUrl } from "@/lib/youtube";
import { createMeal, updateMeal, copyRecipeImageToStorage } from "@/app/(main)/food/actions";
import { MEAL_TAGS } from "@/lib/mealUtils";
import { FridgeStockSheet } from "@/components/food/FridgeStockSheet";
import { RecipeSearchSheet } from "@/components/food/RecipeSearchSheet";
import { RecentMenuSection } from "@/components/food/RecentMenuSection";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";
import type { FridgeItem, Meal, MealType } from "@/types";

const MEAL_TYPES: MealType[] = ["집밥", "외식", "배달"];

// 섹션(끼니/식사 유형/메뉴/메모) 사이 구분선 — 0.5px 헤어라인.
const SECTION_DIVIDER = "border-t-[0.5px] border-border-light pt-4";

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
  defaultMenu,
  prefillImageUrl,
  prefillIngredients,
  prefillMemo,
  fridgeItems,
  existingMeal,
  recipeSearchEnabled = false,
  foodSafetyEnabled = false,
}: {
  workspaceId: string;
  defaultDate: string;
  /** "자주 찾는 메뉴" 마퀴/추천 레시피 상세의 메뉴명 — 수정 모드(existingMeal)에선 무시된다. */
  defaultMenu?: string;
  /** 추천 레시피 상세("오늘 메뉴로 추가하기")에서 넘어온, 이미 우리 Storage로 복사된 이미지 URL. */
  prefillImageUrl?: string;
  /** 추천 레시피 상세에서 넘어온 재료 목록. */
  prefillIngredients?: string[];
  /** 추천 레시피 상세에서 넘어온 조리 단계 요약(3줄 이내). */
  prefillMemo?: string;
  fridgeItems: FridgeItem[];
  existingMeal?: Meal;
  /** NAVER_CLIENT_ID/SECRET 설정 여부(isRecipeSearchEnabled) — 꺼져 있으면 "레시피 찾아보기"의
   * 블로그 탭을 숨긴다. */
  recipeSearchEnabled?: boolean;
  /** FOOD_SAFETY_API_KEY 설정 여부(isFoodSafetyRecipeEnabled) — 꺼져 있으면 "레시피 찾아보기"의
   * 레시피(내부) 탭을 숨긴다. */
  foodSafetyEnabled?: boolean;
}) {
  const { showToast } = useToast();
  const [tag, setTag] = useState(existingMeal?.tag ?? MEAL_TAGS[0]);
  const [type, setType] = useState<MealType>(existingMeal?.type ?? "집밥");
  const [mainMenu, setMainMenu] = useState(existingMeal?.main_menu ?? defaultMenu ?? "");
  const [place, setPlace] = useState(existingMeal?.place ?? "");
  const [reservationTime, setReservationTime] = useState(
    existingMeal?.reservation_time ?? ""
  );
  const [memo, setMemo] = useState(existingMeal?.memo ?? prefillMemo ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    existingMeal?.image_url ?? prefillImageUrl ?? null
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(existingMeal?.video_id ?? null);
  const [recipeTitle, setRecipeTitle] = useState<string | null>(existingMeal?.recipe_title ?? null);
  const [recipeUrl, setRecipeUrl] = useState<string | null>(existingMeal?.recipe_url ?? null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(
    existingMeal?.ingredients ?? prefillIngredients ?? []
  );
  const [thumbnailError, setThumbnailError] = useState(false);
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);
  const [recipeLinkOpen, setRecipeLinkOpen] = useState(false);
  const [recipeLinkDraft, setRecipeLinkDraft] = useState("");
  const [isFetchingRecipe, setIsFetchingRecipe] = useState(false);
  const [recipeSearchOpen, setRecipeSearchOpen] = useState(false);
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const albumFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setThumbnailError(false);
  }, [videoId]);

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

      const compressedDataUrl = await compressImage(file);
      const blob = await (await fetch(compressedDataUrl)).blob();
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("meal-images")
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (error) throw error;

      const { data } = supabase.storage.from("meal-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch {
      showToast("이미지 업로드에 실패했어요.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFetchRecipeLink = async () => {
    const url = recipeLinkDraft.trim();
    if (!url) return;
    setIsFetchingRecipe(true);
    try {
      const result = await fetchYoutubeOembed(url);
      if ("error" in result) {
        showToast(result.error);
        return;
      }
      setVideoId(result.videoId);
      setRecipeTitle(result.title);
      setRecipeLinkOpen(false);
      setRecipeLinkDraft("");
    } finally {
      setIsFetchingRecipe(false);
    }
  };

  const handleSelectRecentMeal = (meal: Meal) => {
    setTag(meal.tag);
    setType(meal.type);
    // sides는 UI 입력 필드가 없어져 메뉴 쉼표 텍스트로 통합됐으므로(위 handleSubmit 참고),
    // 복사도 같은 방식으로 합쳐 넣는다 — 저장 시 sides는 신규 등록과 동일하게 빈 배열이 됨.
    setMainMenu([meal.main_menu, ...meal.sides].filter(Boolean).join(", "));
    setImageUrl(meal.image_url);
    setVideoId(meal.video_id);
    setRecipeTitle(meal.recipe_title);
    setRecipeUrl(meal.recipe_url);
    setSelectedIngredients(meal.ingredients);
    showToast(`"${meal.main_menu}" 메뉴를 불러왔어요.`);
  };

  // "레시피 찾아보기" 시트의 레시피(내부) 탭에서 검색 결과를 골랐을 때 — 추천 레시피 상세의
  // "오늘 메뉴로 추가하기"와 동일한 채우기 규칙(메뉴명/이미지 복사/재료/조리 요약)을 그
  // 자리에서 바로 적용한다(페이지 이동 없이, 이미 끼니 등록 화면 "안"이므로).
  const handleFillFromRecipe = async (recipe: NormalizedRecipe) => {
    setMainMenu(recipe.name);
    setSelectedIngredients(recipe.ingredients);
    const summary = recipe.steps
      .slice(0, 3)
      .map((s) => s.text)
      .join("\n");
    if (summary) setMemo(summary);

    if (recipe.image) {
      const result = await copyRecipeImageToStorage(recipe.image);
      if (result.ok) setImageUrl(result.url);
      else showToast("레시피 사진은 가져오지 못했지만 나머지 내용은 채워드렸어요.");
    }

    setRecipeSearchOpen(false);
    showToast(`"${recipe.name}" 레시피를 불러왔어요.`);
  };

  const toggleIngredient = (name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
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
      video_id: videoId,
      recipe_title: recipeTitle,
      recipe_url: recipeUrl,
      ingredients: selectedIngredients,
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
    <div className="flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-cream">
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <Link
          href={existingMeal ? `/food/${existingMeal.id}` : "/food"}
          aria-label="뒤로가기"
        >
          <IconArrowLeft size={22} className="text-ink" />
        </Link>
        <h1 className="text-[15px] font-medium text-ink">
          {existingMeal ? "끼니 수정" : "끼니 추가"}
        </h1>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="text-[14px] font-medium text-honey disabled:opacity-40"
        >
          저장
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {!existingMeal && (
          <RecentMenuSection workspaceId={workspaceId} onSelect={handleSelectRecentMeal} />
        )}

        <section className="flex flex-col gap-2">
          <span className={mirror.label}>끼니</span>
          <div className="flex gap-4 overflow-x-auto">
            {MEAL_TAGS.map((t) => (
              <TextToggle key={t} label={t} active={tag === t} onClick={() => setTag(t)} />
            ))}
          </div>
        </section>

        <section className={`flex flex-col gap-2 ${SECTION_DIVIDER}`}>
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

        <section className={`flex flex-col gap-2 ${SECTION_DIVIDER}`}>
          <span className={mirror.label}>메뉴 (쉼표로 여러 개)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPhotoOptionsOpen(true)}
              disabled={isUploadingImage}
              aria-label="사진/레시피 추가"
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
            ref={cameraFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelected}
          />
          <input
            ref={albumFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelected}
          />
          {videoId && (
            <div className="flex items-center gap-2">
              {thumbnailError ? (
                <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-cream">
                  <IconBrandYoutube size={18} className="text-[var(--text-muted)]" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={youtubeThumbnailUrl(videoId)}
                  alt=""
                  className="h-10 w-16 shrink-0 rounded-lg object-cover"
                  onError={() => setThumbnailError(true)}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-muted)]">
                {recipeTitle ?? "레시피 영상"}
              </span>
              <button
                onClick={() => {
                  setVideoId(null);
                  setRecipeTitle(null);
                }}
                aria-label="레시피 제거"
                className="shrink-0"
              >
                <IconX size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
          )}
          {recipeUrl && (
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-cream">
                <IconLink size={18} className="text-[var(--text-muted)]" />
              </div>
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-muted)]">
                레시피 블로그 저장됨
              </span>
              <button
                onClick={() => setRecipeUrl(null)}
                aria-label="레시피 블로그 링크 제거"
                className="shrink-0"
              >
                <IconX size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
          )}
          {selectedIngredients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedIngredients.map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[12px] text-ink"
                >
                  {name}
                  <button onClick={() => toggleIngredient(name)} aria-label={`${name} 제거`}>
                    <IconX size={11} className="text-[var(--text-muted)]" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => setFridgeOpen(true)}
            className="flex items-center gap-1.5 self-start text-[13px] font-medium text-honey"
          >
            <IconFridge size={18} />
            집에 뭐 있지
          </button>
        </section>

        <section className={`flex flex-col gap-2 ${SECTION_DIVIDER}`}>
          <span className={mirror.label}>메모 (선택)</span>
          <Textarea
            variant="underline"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="자유롭게 적어보세요"
            className="px-0 py-2 text-[12px]"
          />
        </section>
      </div>

      <FridgeStockSheet
        open={fridgeOpen}
        onClose={() => setFridgeOpen(false)}
        workspaceId={workspaceId}
        items={fridgeItems}
        selectedNames={selectedIngredients}
        onToggleItem={toggleIngredient}
      />

      <BottomSheet open={photoOptionsOpen} onClose={() => setPhotoOptionsOpen(false)}>
        <div className="flex flex-col">
          <button
            onClick={() => {
              setPhotoOptionsOpen(false);
              cameraFileInputRef.current?.click();
            }}
            className="flex items-center gap-3 py-3 text-left text-[14px] text-ink"
          >
            <IconCamera size={18} className="text-honey" />
            카메라로 찍기
          </button>
          <button
            onClick={() => {
              setPhotoOptionsOpen(false);
              albumFileInputRef.current?.click();
            }}
            className="flex items-center gap-3 border-t border-border-light py-3 text-left text-[14px] text-ink"
          >
            <IconPhoto size={18} className="text-honey" />
            앨범에서 선택
          </button>
          <button
            onClick={() => {
              setPhotoOptionsOpen(false);
              setRecipeSearchOpen(true);
            }}
            className="flex items-center gap-3 border-t border-border-light py-3 text-left text-[14px] text-ink"
          >
            <IconSearch size={18} className="text-honey" />
            레시피 찾아보기
          </button>
          <button
            onClick={() => {
              setPhotoOptionsOpen(false);
              setRecipeLinkOpen(true);
            }}
            className="flex items-center gap-3 border-t border-border-light py-3 text-left text-[14px] text-ink"
          >
            <IconLink size={18} className="text-honey" />
            레시피 링크 붙여넣기
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={recipeLinkOpen} onClose={() => setRecipeLinkOpen(false)}>
        <div className="flex flex-col gap-4">
          <span className="text-[15px] font-medium text-ink">레시피 링크 붙여넣기</span>
          <Input
            variant="underline"
            value={recipeLinkDraft}
            onChange={(e) => setRecipeLinkDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetchRecipeLink()}
            placeholder="유튜브 영상 URL"
            className="h-11 px-0 text-[14px]"
          />
          <button
            onClick={handleFetchRecipeLink}
            disabled={isFetchingRecipe || !recipeLinkDraft.trim()}
            className="flex h-11 items-center justify-center rounded-2xl bg-ink text-[14px] font-medium text-cream disabled:opacity-50"
          >
            {isFetchingRecipe ? "불러오는 중..." : "가져오기"}
          </button>
        </div>
      </BottomSheet>

      <RecipeSearchSheet
        open={recipeSearchOpen}
        onClose={() => setRecipeSearchOpen(false)}
        defaultQuery={mainMenu}
        memo={memo}
        onMemoChange={setMemo}
        blogEnabled={recipeSearchEnabled}
        internalEnabled={foodSafetyEnabled}
        onSaveBlogLink={(url) => {
          setRecipeUrl(url);
          setRecipeSearchOpen(false);
          showToast("레시피 링크를 저장했어요.");
        }}
        onFillFromRecipe={handleFillFromRecipe}
      />
    </div>
  );
}
