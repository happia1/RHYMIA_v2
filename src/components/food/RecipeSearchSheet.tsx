"use client";

import { useEffect, useMemo, useState } from "react";
import { IconSearch, IconArticle, IconBrandYoutube, IconLink } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input, Textarea } from "@/components/ui/Input";
import { searchRecipeBlogs, searchInternalRecipes, type RecipeBlogResult } from "@/lib/recipeSearch";
import {
  getRecipeNotes,
  toggleRecipeFavorite,
  recordRecipeViewed,
} from "@/app/(main)/food/actions";
import { RecipeDetailSheet } from "@/components/food/RecipeDetailSheet";
import { RecipeRow } from "@/components/food/RecipeRow";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

type TabId = "internal" | "blog" | "youtube";
const TAB_LABEL: Record<TabId, string> = { internal: "레시피", blog: "블로그", youtube: "유튜브" };
const MAX_LOCAL_RECENT = 30;

/** "레시피 찾아보기" — 소스별 탭([레시피(내부) | 블로그 | 유튜브])으로 나뉘어 있고, 설정되지
 * 않은 소스는 탭 자체가 안 보인다(blogEnabled/internalEnabled 게이트, 유튜브는 외부 링크만
 * 열면 되므로 게이트 불필요 — 항상 노출). 레시피(내부) 탭은 검색어가 없으면 "내 레시피
 * 노트"(즐겨찾기)와 "최근 본 레시피"를 보여주고, 검색어를 입력하면 검색 결과로 교체된다.
 * 항목을 탭하면(별 제외) 상세 시트를 거쳐 "채우기/오늘 메뉴로 추가"로 이어진다.
 * 끼니 등록 화면 "안"(onFillFromRecipe 등 전달)과 식탁 탭 "레시피" 섹션(단독, selectedDate만
 * 전달) 양쪽에서 재사용한다 — 끼니 등록 화면 전용 콜백(onFillFromRecipe/onSaveBlogLink/
 * onOpenLinkPaste/memo)이 없으면 그 자리에서 채우는 대신 각각 자연스러운 기본 동작으로
 * 대체한다("오늘 메뉴로 추가하기"는 /food/add로 이동, 블로그 저장·메모·링크 붙여넣기는
 * 그 맥락이 없어 버튼 자체를 숨김). */
export function RecipeSearchSheet({
  open,
  onClose,
  workspaceId,
  defaultQuery,
  memo,
  onMemoChange,
  blogEnabled,
  internalEnabled,
  selectedDate,
  onSaveBlogLink,
  onFillFromRecipe,
  onOpenLinkPaste,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  defaultQuery: string;
  memo?: string;
  onMemoChange?: (value: string) => void;
  /** NAVER_CLIENT_ID/SECRET 설정 여부 — 꺼져 있으면 블로그 탭 자체를 숨긴다. */
  blogEnabled: boolean;
  /** FOOD_SAFETY_API_KEY 설정 여부 — 꺼져 있으면 레시피(내부) 탭 자체를 숨긴다. */
  internalEnabled: boolean;
  /** 끼니 등록 화면 밖(식탁 탭 "레시피" 섹션)에서 단독으로 열렸을 때만 필요 — 상세의
   * "오늘 메뉴로 추가하기"가 이동할 날짜. */
  selectedDate?: string;
  onSaveBlogLink?: (url: string) => void;
  onFillFromRecipe?: (recipe: NormalizedRecipe) => void;
  /** "레시피 링크 붙여넣기" 보조 액션 — 끼니 등록 화면 안에서 열렸을 때만 전달(AddMealScreen이 관리). */
  onOpenLinkPaste?: () => void;
}) {
  const availableTabs = useMemo<TabId[]>(
    () => (["internal", "blog", "youtube"] as TabId[]).filter(
      (t) => (t === "internal" ? internalEnabled : t === "blog" ? blogEnabled : true)
    ),
    [internalEnabled, blogEnabled]
  );
  const [tab, setTab] = useState<TabId>(availableTabs[0] ?? "youtube");

  const [internalQuery, setInternalQuery] = useState(defaultQuery);
  const [internalResults, setInternalResults] = useState<NormalizedRecipe[] | null>(null);
  const [internalSearching, setInternalSearching] = useState(false);
  const [internalError, setInternalError] = useState("");

  const [blogQuery, setBlogQuery] = useState(defaultQuery);
  const [blogResults, setBlogResults] = useState<RecipeBlogResult[] | null>(null);
  const [blogSearching, setBlogSearching] = useState(false);
  const [blogError, setBlogError] = useState("");

  const [favorites, setFavorites] = useState<NormalizedRecipe[]>([]);
  const [recent, setRecent] = useState<NormalizedRecipe[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [detailRecipe, setDetailRecipe] = useState<NormalizedRecipe | null>(null);

  const isFavorite = (recipe: NormalizedRecipe) => favorites.some((f) => f.id === recipe.id);

  const runInternalSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setInternalSearching(true);
    setInternalError("");
    const result = await searchInternalRecipes(trimmed);
    setInternalSearching(false);
    if ("error" in result) {
      setInternalError(result.error);
      setInternalResults([]);
      return;
    }
    setInternalResults(result.items);
  };

  const runBlogSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setBlogSearching(true);
    setBlogError("");
    const result = await searchRecipeBlogs(trimmed);
    setBlogSearching(false);
    if ("error" in result) {
      setBlogError(result.error);
      setBlogResults([]);
      return;
    }
    setBlogResults(result.items);
  };

  const openYoutubeSearch = () => {
    const query = `${defaultQuery.trim() || "레시피"} 레시피`;
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // 시트가 열릴 때마다 메뉴명으로 두 검색 탭을 프리필하고 현재 활성 탭만 바로 한 번 검색해둔다.
  // 레시피(내부) 탭의 즐겨찾기/최근 본 목록도 매번 새로 불러온다.
  useEffect(() => {
    if (!open) return;
    const initialTab = availableTabs[0] ?? "youtube";
    setTab(initialTab);
    setInternalQuery(defaultQuery);
    setInternalResults(null);
    setInternalError("");
    setBlogQuery(defaultQuery);
    setBlogResults(null);
    setBlogError("");
    if (defaultQuery.trim()) {
      if (initialTab === "internal") runInternalSearch(defaultQuery);
      else if (initialTab === "blog") runBlogSearch(defaultQuery);
    }

    if (internalEnabled) {
      setNotesLoading(true);
      getRecipeNotes(workspaceId).then((result) => {
        setFavorites(result.favorites);
        setRecent(result.recent);
        setNotesLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQuery, workspaceId]);

  // 탭을 전환했는데 아직 그 탭에서 검색한 적이 없으면 프리필된 메뉴명으로 한 번 자동 검색.
  const handleTabChange = (next: TabId) => {
    setTab(next);
    if (next === "internal" && internalResults === null && internalQuery.trim()) {
      runInternalSearch(internalQuery);
    }
    if (next === "blog" && blogResults === null && blogQuery.trim()) {
      runBlogSearch(blogQuery);
    }
  };

  const handleToggleFavorite = async (recipe: NormalizedRecipe) => {
    const wasFavorite = isFavorite(recipe);
    // 낙관적 업데이트 — 실패하면 아래에서 되돌린다.
    setFavorites((prev) => (wasFavorite ? prev.filter((r) => r.id !== recipe.id) : [recipe, ...prev]));
    const result = await toggleRecipeFavorite(workspaceId, recipe);
    if (!result.ok) {
      setFavorites((prev) => (wasFavorite ? [recipe, ...prev] : prev.filter((r) => r.id !== recipe.id)));
    }
  };

  const handleOpenDetail = (recipe: NormalizedRecipe) => {
    setDetailRecipe(recipe);
    recordRecipeViewed(workspaceId, recipe);
    // "최근 본" 순서를 다음 조회 없이 바로 반영 — 이미 있으면 맨 앞으로, 없으면 새로 추가.
    setRecent((prev) => [recipe, ...prev.filter((r) => r.id !== recipe.id)].slice(0, MAX_LOCAL_RECENT));
  };

  return (
    <BottomSheet open={open} onClose={onClose} fixedHeight>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <span className="text-[18px] font-medium text-ink">레시피 찾아보기</span>

        {availableTabs.length > 1 && (
          <div className="flex gap-4 border-b border-border-light">
            {availableTabs.map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`-mb-px border-b-2 pb-2 text-[16px] font-medium ${
                  tab === t ? "border-honey text-ink" : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "internal" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input
                  variant="underline"
                  value={internalQuery}
                  onChange={(e) => setInternalQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runInternalSearch(internalQuery)}
                  placeholder="메뉴명으로 검색"
                  className="h-10 flex-1 px-0 text-[16px]"
                />
                <button onClick={() => runInternalSearch(internalQuery)} disabled={internalSearching} aria-label="검색">
                  <IconSearch size={18} className="text-[var(--text-muted)]" />
                </button>
              </div>

              {!internalQuery.trim() ? (
                <div className="flex flex-col gap-4">
                  {notesLoading && (
                    <p className="py-6 text-center text-[16px] text-[var(--text-muted)]">불러오는 중...</p>
                  )}
                  {!notesLoading && favorites.length === 0 && recent.length === 0 && (
                    <p className="py-6 text-center text-[16px] text-[var(--text-muted)]">
                      메뉴명으로 검색해보세요
                    </p>
                  )}
                  {favorites.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-medium text-stone">내 레시피 노트</span>
                      {favorites.map((r, i) => (
                        <RecipeRow
                          key={r.id}
                          recipe={r}
                          isFavorite
                          onToggleFavorite={() => handleToggleFavorite(r)}
                          onOpen={() => handleOpenDetail(r)}
                          divider={i > 0}
                        />
                      ))}
                    </div>
                  )}
                  {recent.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-medium text-stone">최근 본 레시피</span>
                      {recent.map((r, i) => (
                        <RecipeRow
                          key={r.id}
                          recipe={r}
                          isFavorite={isFavorite(r)}
                          onToggleFavorite={() => handleToggleFavorite(r)}
                          onOpen={() => handleOpenDetail(r)}
                          divider={i > 0}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {internalSearching && (
                    <p className="py-6 text-center text-[16px] text-[var(--text-muted)]">검색 중...</p>
                  )}
                  {internalError && (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <p className="text-[16px] text-terra">{internalError}</p>
                      <button
                        onClick={() => runInternalSearch(internalQuery)}
                        className="text-[14px] font-medium text-honey"
                      >
                        다시 시도
                      </button>
                    </div>
                  )}
                  {internalResults?.length === 0 && !internalError && (
                    <p className="py-6 text-center text-[16px] text-[var(--text-muted)]">
                      검색 결과가 없어요
                    </p>
                  )}
                  {internalResults?.map((r, i) => (
                    <RecipeRow
                      key={r.id}
                      recipe={r}
                      isFavorite={isFavorite(r)}
                      onToggleFavorite={() => handleToggleFavorite(r)}
                      onOpen={() => handleOpenDetail(r)}
                      divider={i > 0}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "blog" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input
                  variant="underline"
                  value={blogQuery}
                  onChange={(e) => setBlogQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runBlogSearch(blogQuery)}
                  placeholder="메뉴명으로 검색"
                  className="h-10 flex-1 px-0 text-[16px]"
                />
                <button onClick={() => runBlogSearch(blogQuery)} disabled={blogSearching} aria-label="검색">
                  <IconSearch size={18} className="text-[var(--text-muted)]" />
                </button>
              </div>

              {onMemoChange && (
                <Textarea
                  value={memo ?? ""}
                  onChange={(e) => onMemoChange(e.target.value)}
                  placeholder="레시피 보면서 메모해두기 (선택)"
                  rows={2}
                  className="rounded-xl bg-cream p-3 text-[16px]"
                />
              )}

              <div className="flex flex-col gap-3">
                {blogSearching && (
                  <p className="py-6 text-center text-[16px] text-[var(--text-muted)]">검색 중...</p>
                )}
                {blogError && <p className="text-[16px] text-terra">{blogError}</p>}
                {blogResults?.length === 0 && !blogError && (
                  <p className="py-6 text-center text-[16px] text-[var(--text-muted)]">
                    검색 결과가 없어요
                  </p>
                )}
                {blogResults?.map((r, i) => (
                  <div
                    key={`${r.link}-${i}`}
                    className={`flex flex-col gap-2 pb-3 ${i > 0 ? "border-t border-border-light pt-3" : ""}`}
                  >
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cream">
                        <IconArticle size={22} className="text-[var(--text-muted)]" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="line-clamp-2 text-[16px] font-medium text-ink">{r.title}</span>
                        <span className="line-clamp-2 text-[14px] text-stone">{r.summary}</span>
                        <span className="truncate text-[13px] text-[var(--text-muted)]">{r.blogName}</span>
                      </div>
                    </a>
                    {onSaveBlogLink && (
                      <button
                        onClick={() => onSaveBlogLink(r.link)}
                        className="self-start text-[14px] font-medium text-honey"
                      >
                        이 레시피 저장
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "youtube" && (
            <div className="flex flex-col gap-4">
              {onMemoChange && (
                <Textarea
                  value={memo ?? ""}
                  onChange={(e) => onMemoChange(e.target.value)}
                  placeholder="레시피 보면서 메모해두기 (선택)"
                  rows={2}
                  className="rounded-xl bg-cream p-3 text-[16px]"
                />
              )}
              <button
                onClick={openYoutubeSearch}
                className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[17px] font-medium text-cream"
              >
                <IconBrandYoutube size={18} />
                유튜브에서 새 창으로 검색
              </button>
            </div>
          )}
        </div>

        {onOpenLinkPaste && (
          <button
            onClick={onOpenLinkPaste}
            className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border-light pt-3 text-[14px] font-medium text-[var(--text-muted)]"
          >
            <IconLink size={14} />
            레시피 링크 붙여넣기
          </button>
        )}
      </div>

      <RecipeDetailSheet
        recipe={detailRecipe}
        open={!!detailRecipe}
        onClose={() => setDetailRecipe(null)}
        selectedDate={selectedDate}
        onFillFromRecipe={
          onFillFromRecipe
            ? (r) => {
                setDetailRecipe(null);
                onFillFromRecipe(r);
              }
            : undefined
        }
      />
    </BottomSheet>
  );
}
