"use client";

import { useEffect, useMemo, useState } from "react";
import { IconSearch, IconArticle, IconBrandYoutube, IconToolsKitchen2 } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input, Textarea } from "@/components/ui/Input";
import { searchRecipeBlogs, searchInternalRecipes, type RecipeBlogResult } from "@/lib/recipeSearch";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

type TabId = "internal" | "blog" | "youtube";
const TAB_LABEL: Record<TabId, string> = { internal: "레시피", blog: "블로그", youtube: "유튜브" };

/** 끼니 등록/수정 화면의 "레시피 찾아보기" — 소스별 탭([레시피(내부) | 블로그 | 유튜브])으로
 * 나뉘어 있고, 설정되지 않은 소스는 탭 자체가 안 보인다(blogEnabled/internalEnabled 게이트,
 * 유튜브는 외부 링크만 열면 되므로 게이트 불필요 — 항상 노출). 메모 입력란은 블로그/유튜브
 * 탭처럼 "보면서 바로 메모"가 필요한 흐름에서만 의미가 있어 그 두 탭에서만 보여준다 —
 * 레시피(내부) 탭은 재료/조리 단계까지 이미 구조화돼 있어 "채우기" 한 번으로 메뉴명·이미지·
 * 재료·조리 요약(메모)까지 전부 채워지므로 메모를 따로 적을 필요가 없다. */
export function RecipeSearchSheet({
  open,
  onClose,
  defaultQuery,
  memo,
  onMemoChange,
  blogEnabled,
  internalEnabled,
  onSaveBlogLink,
  onFillFromRecipe,
}: {
  open: boolean;
  onClose: () => void;
  defaultQuery: string;
  memo: string;
  onMemoChange: (value: string) => void;
  /** NAVER_CLIENT_ID/SECRET 설정 여부 — 꺼져 있으면 블로그 탭 자체를 숨긴다. */
  blogEnabled: boolean;
  /** FOOD_SAFETY_API_KEY 설정 여부 — 꺼져 있으면 레시피(내부) 탭 자체를 숨긴다. */
  internalEnabled: boolean;
  onSaveBlogLink: (url: string) => void;
  onFillFromRecipe: (recipe: NormalizedRecipe) => void;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQuery]);

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

  return (
    <BottomSheet open={open} onClose={onClose} tall>
      <div className="flex flex-col gap-4">
        <span className="text-[15px] font-medium text-ink">레시피 찾아보기</span>

        {availableTabs.length > 1 && (
          <div className="flex gap-4 border-b border-border-light">
            {availableTabs.map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`-mb-px border-b-2 pb-2 text-[13px] font-medium ${
                  tab === t ? "border-honey text-ink" : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        {tab === "internal" && (
          <>
            <div className="flex items-center gap-2">
              <Input
                variant="underline"
                value={internalQuery}
                onChange={(e) => setInternalQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runInternalSearch(internalQuery)}
                placeholder="메뉴명으로 검색"
                className="h-10 flex-1 px-0 text-[13px]"
              />
              <button onClick={() => runInternalSearch(internalQuery)} disabled={internalSearching} aria-label="검색">
                <IconSearch size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {internalSearching && (
                <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">검색 중...</p>
              )}
              {internalError && <p className="text-[13px] text-terra">{internalError}</p>}
              {internalResults?.length === 0 && !internalError && (
                <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">
                  검색 결과가 없어요
                </p>
              )}
              {internalResults?.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-start gap-3 pb-3 ${i > 0 ? "border-t border-border-light pt-3" : ""}`}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <IconToolsKitchen2 size={20} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="line-clamp-2 text-[13px] font-medium text-ink">{r.name}</span>
                    <button
                      onClick={() => onFillFromRecipe(r)}
                      className="self-start text-[12px] font-medium text-honey"
                    >
                      이 레시피로 채우기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "blog" && (
          <>
            <div className="flex items-center gap-2">
              <Input
                variant="underline"
                value={blogQuery}
                onChange={(e) => setBlogQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runBlogSearch(blogQuery)}
                placeholder="메뉴명으로 검색"
                className="h-10 flex-1 px-0 text-[13px]"
              />
              <button onClick={() => runBlogSearch(blogQuery)} disabled={blogSearching} aria-label="검색">
                <IconSearch size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <Textarea
              value={memo}
              onChange={(e) => onMemoChange(e.target.value)}
              placeholder="레시피 보면서 메모해두기 (선택)"
              rows={2}
              className="rounded-xl bg-cream p-3 text-[13px]"
            />

            <div className="flex flex-col gap-3">
              {blogSearching && (
                <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">검색 중...</p>
              )}
              {blogError && <p className="text-[13px] text-terra">{blogError}</p>}
              {blogResults?.length === 0 && !blogError && (
                <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">
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
                      <span className="line-clamp-2 text-[13px] font-medium text-ink">{r.title}</span>
                      <span className="line-clamp-2 text-[12px] text-stone">{r.summary}</span>
                      <span className="truncate text-[11px] text-[var(--text-muted)]">{r.blogName}</span>
                    </div>
                  </a>
                  <button
                    onClick={() => onSaveBlogLink(r.link)}
                    className="self-start text-[12px] font-medium text-honey"
                  >
                    이 레시피 저장
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "youtube" && (
          <>
            <Textarea
              value={memo}
              onChange={(e) => onMemoChange(e.target.value)}
              placeholder="레시피 보면서 메모해두기 (선택)"
              rows={2}
              className="rounded-xl bg-cream p-3 text-[13px]"
            />
            <button
              onClick={openYoutubeSearch}
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[14px] font-medium text-cream"
            >
              <IconBrandYoutube size={18} />
              유튜브에서 새 창으로 검색
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
