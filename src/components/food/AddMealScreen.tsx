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
import { createMeal, updateMeal } from "@/app/(main)/food/actions";
import { MEAL_TAGS } from "@/lib/mealUtils";
import { FridgeStockSheet } from "@/components/food/FridgeStockSheet";
import { RecipeSearchSheet } from "@/components/food/RecipeSearchSheet";
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
  fridgeItems,
  existingMeal,
  recipeSearchEnabled = false,
}: {
  workspaceId: string;
  defaultDate: string;
  /** "자주 찾는 메뉴" 마퀴에서 메뉴를 탭해 들어왔을 때 프리필할 이름 — 수정 모드(existingMeal)
   * 에선 무시된다. */
  defaultMenu?: string;
  fridgeItems: FridgeItem[];
  existingMeal?: Meal;
  /** NAVER_CLIENT_ID/SECRET 설정 여부(isRecipeSearchEnabled) — 꺼져 있으면 "블로그에서
   * 레시피 찾기" 메뉴 자체를 노출하지 않는다. */
  recipeSearchEnabled?: boolean;
}) {
  const { showToast } = useToast();
  const [tag, setTag] = useState(existingMeal?.tag ?? MEAL_TAGS[0]);
  const [type, setType] = useState<MealType>(existingMeal?.type ?? "집밥");
  const [mainMenu, setMainMenu] = useState(existingMeal?.main_menu ?? defaultMenu ?? "");
  const [place, setPlace] = useState(existingMeal?.place ?? "");
  const [reservationTime, setReservationTime] = useState(
    existingMeal?.reservation_time ?? ""
  );
  const [memo, setMemo] = useState(existingMeal?.memo ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(existingMeal?.image_url ?? null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(existingMeal?.video_id ?? null);
  const [recipeTitle, setRecipeTitle] = useState<string | null>(existingMeal?.recipe_title ?? null);
  const [recipeUrl, setRecipeUrl] = useState<string | null>(existingMeal?.recipe_url ?? null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(
    existingMeal?.ingredients ?? []
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

  const openYoutubeSearch = () => {
    const query = `${mainMenu.trim() || "레시피"} 레시피`;
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
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
              openYoutubeSearch();
            }}
            className="flex items-center gap-3 border-t border-border-light py-3 text-left text-[14px] text-ink"
          >
            <IconBrandYoutube size={18} className="text-honey" />
            유튜브에서 레시피 찾기
          </button>
          {recipeSearchEnabled && (
            <button
              onClick={() => {
                setPhotoOptionsOpen(false);
                setRecipeSearchOpen(true);
              }}
              className="flex items-center gap-3 border-t border-border-light py-3 text-left text-[14px] text-ink"
            >
              <IconSearch size={18} className="text-honey" />
              블로그에서 레시피 찾기
            </button>
          )}
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

      {recipeSearchEnabled && (
        <RecipeSearchSheet
          open={recipeSearchOpen}
          onClose={() => setRecipeSearchOpen(false)}
          defaultQuery={mainMenu}
          memo={memo}
          onMemoChange={setMemo}
          onSave={(url) => {
            setRecipeUrl(url);
            setRecipeSearchOpen(false);
            showToast("레시피 링크를 저장했어요.");
          }}
        />
      )}
    </div>
  );
}
