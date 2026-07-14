"use client";

import { useEffect, useState } from "react";
import { IconSearch, IconArticle } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input, Textarea } from "@/components/ui/Input";
import { searchRecipeBlogs, type RecipeBlogResult } from "@/lib/recipeSearch";

/** 끼니 등록/수정 화면의 "블로그에서 레시피 찾기" — 메뉴명을 프리필해 네이버 블로그 검색을
 * 열고, 결과를 훑으면서 메모를 바로 적을 수 있게 메모 입력란을 같은 화면에 둔다(메모는 항상
 * 사용자가 직접 입력 — 본문 자동 추출은 저작권 문제로 하지 않음). 항목을 탭하면 블로그 글이
 * 새 창으로 열리고, "이 레시피 저장"을 눌러야 recipe_url이 폼에 반영된다.
 *
 * 참고: 네이버 블로그 검색 API 응답에는 썸네일 이미지 필드가 없어(공식 문서 기준) 실제
 * 게시글 썸네일 대신 자리표시 아이콘을 쓴다. */
export function RecipeSearchSheet({
  open,
  onClose,
  defaultQuery,
  memo,
  onMemoChange,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  defaultQuery: string;
  memo: string;
  onMemoChange: (value: string) => void;
  onSave: (recipeUrl: string) => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<RecipeBlogResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setError("");
    const result = await searchRecipeBlogs(trimmed);
    setIsSearching(false);
    if ("error" in result) {
      setError(result.error);
      setResults([]);
      return;
    }
    setResults(result.items);
  };

  // 시트가 열릴 때마다 메뉴명으로 프리필하고 바로 한 번 검색해둔다.
  useEffect(() => {
    if (!open) return;
    setQuery(defaultQuery);
    setResults(null);
    setError("");
    if (defaultQuery.trim()) runSearch(defaultQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQuery]);

  return (
    <BottomSheet open={open} onClose={onClose} tall>
      <div className="flex flex-col gap-4">
        <span className="text-[15px] font-medium text-ink">레시피 블로그 찾기</span>

        <div className="flex items-center gap-2">
          <Input
            variant="underline"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
            placeholder="메뉴명으로 검색"
            className="h-10 flex-1 px-0 text-[13px]"
          />
          <button
            onClick={() => runSearch(query)}
            disabled={isSearching}
            aria-label="검색"
          >
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
          {isSearching && (
            <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">검색 중...</p>
          )}
          {error && <p className="text-[13px] text-terra">{error}</p>}
          {results?.length === 0 && !error && (
            <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">
              검색 결과가 없어요
            </p>
          )}
          {results?.map((r, i) => (
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
                onClick={() => onSave(r.link)}
                className="self-start text-[12px] font-medium text-honey"
              >
                이 레시피 저장
              </button>
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
