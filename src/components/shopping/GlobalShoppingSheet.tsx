"use client";

import { useEffect, useState, useTransition } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { toDateStr } from "@/lib/date";
import { completeGroceryRun, getGroceryRuns, searchGroceryRuns, type GroceryRun } from "@/app/(main)/shopping/actions";
import { ShoppingListPanel } from "@/components/shopping/ShoppingListPanel";

const LABEL_CLASS = "text-[10px] tracking-[0.12em] font-medium text-stone";
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function GlobalShoppingSheet({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"list" | "history">("list");

  useEffect(() => {
    if (open) setTab("list");
  }, [open]);

  return (
    <BottomSheet open={open} onClose={onClose} tall>
      <div className="flex flex-col gap-4">
        <div className="flex shrink-0 gap-4 border-b border-border-light">
          {(["list", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 pb-2 text-[13px] font-medium ${
                tab === t ? "border-honey text-ink" : "border-transparent text-[var(--text-muted)]"
              }`}
            >
              {t === "list" ? "장볼 것" : "기록"}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠를 고정 높이(기록 탭 기준 — 달력+목록이 있어 두 탭 중 더 크다) 안에 두고
            그 안에서만 스크롤되게 한다 — 안 그러면 "장볼 것"(짧음)과 "기록"(김) 사이를
            오갈 때마다 시트 전체 높이가 출렁였다. */}
        <div className="flex h-[65dvh] flex-col overflow-y-auto">
          {tab === "list" ? (
            <ShoppingListPanel workspaceId={workspaceId} />
          ) : (
            <GroceryHistoryTab workspaceId={workspaceId} />
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function GroceryHistoryTab({ workspaceId }: { workspaceId: string }) {
  const { showToast } = useToast();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [monthRuns, setMonthRuns] = useState<GroceryRun[]>([]);
  const [searchResults, setSearchResults] = useState<GroceryRun[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [openRun, setOpenRun] = useState<GroceryRun | null>(null);
  const [addFlowOpen, setAddFlowOpen] = useState(false);
  const [addDate, setAddDate] = useState(() => toDateStr(new Date()));
  const [addPlace, setAddPlace] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [isAddPending, startAddTransition] = useTransition();

  const loadRuns = () => {
    getGroceryRuns(workspaceId, anchor.year, anchor.month).then((result) => {
      if (!result.ok) {
        setLoadError(result.message);
        setMonthRuns([]);
        return;
      }
      setLoadError("");
      setMonthRuns(result.runs);
    });
  };

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, anchor]);

  const handleAddRecord = () => {
    startAddTransition(async () => {
      const result = await completeGroceryRun(workspaceId, {
        itemIds: [],
        place: addPlace.trim() || null,
        amount: addAmount ? Number(addAmount) : null,
        date: addDate,
        addToFridge: false,
      });
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      setAddFlowOpen(false);
      setAddPlace("");
      setAddAmount("");
      setAddDate(toDateStr(new Date()));
      loadRuns();
    });
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      searchGroceryRuns(workspaceId, trimmed).then((result) => {
        if (result.ok) setSearchResults(result.runs);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  const shiftMonth = (delta: number) => {
    const d = new Date(anchor.year, anchor.month + delta, 1);
    setAnchor({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDay(null);
  };

  const monthTotal = monthRuns.reduce((s, r) => s + r.amount, 0);
  const runDays = new Set(monthRuns.map((r) => Number(r.date.slice(-2))));
  const todayStr = toDateStr(new Date());

  const visibleRuns = searchResults
    ? searchResults
    : selectedDay
    ? monthRuns.filter((r) => Number(r.date.slice(-2)) === selectedDay)
    : monthRuns;

  const first = new Date(anchor.year, anchor.month, 1).getDay();
  const daysInMonth = new Date(anchor.year, anchor.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  if (openRun) {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setOpenRun(null)}
          className="flex items-center gap-1 self-start text-[13px] text-stone"
        >
          <IconChevronLeft size={16} />
          기록
        </button>
        <div className="flex flex-col gap-1 border-b border-border-light pb-3">
          <span className="text-[17px] font-medium text-ink">{openRun.place || "장보기"}</span>
          <span className="text-[12px] text-stone">
            {openRun.date.replaceAll("-", ".")} · {openRun.itemNames.length}개 품목
          </span>
          <span className="mt-1 text-[20px] font-medium text-honey">{won(openRun.amount)}</span>
        </div>
        <span className={LABEL_CLASS}>산 것들</span>
        <div className="flex flex-col">
          {openRun.itemNames.length === 0 && (
            <p className="py-2.5 text-[13px] text-[var(--text-muted)]">연결된 품목이 없어요</p>
          )}
          {openRun.itemNames.map((name, i) => (
            <div
              key={i}
              className={`py-2.5 text-[14px] text-ink ${i > 0 ? "border-t border-border-light" : ""}`}
            >
              {name}
            </div>
          ))}
        </div>
        <span className={`${LABEL_CLASS} mt-2`}>영수증</span>
        {openRun.receiptImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={openRun.receiptImageUrl}
            alt=""
            className="h-28 w-24 rounded-lg object-cover"
          />
        ) : (
          <p className="text-[13px] text-[var(--text-muted)]">등록된 영수증이 없어요</p>
        )}
        <button
          disabled
          className="mt-2 flex h-11 items-center justify-center rounded-xl border border-border-light text-[12px] text-stone/40"
        >
          영수증 사진으로 품목·단가 자동입력 · 준비 중
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium text-ink">
          {anchor.year}년 {anchor.month + 1}월
        </span>
        <div className="flex gap-4">
          <button onClick={() => shiftMonth(-1)} aria-label="이전 달">
            <IconChevronLeft size={18} className="text-stone" />
          </button>
          <button onClick={() => shiftMonth(1)} aria-label="다음 달">
            <IconChevronRight size={18} className="text-stone" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 border-b border-border-light pb-3 text-center">
        {DAY_NAMES.map((d) => (
          <span key={d} className={LABEL_CLASS}>
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const dateStr = `${anchor.year}-${pad2(anchor.month + 1)}-${pad2(d)}`;
          const hasRun = runDays.has(d);
          const isToday = dateStr === todayStr;
          const isSelected = selectedDay === d;
          return (
            <button
              key={d}
              onClick={() => {
                setSelectedDay(isSelected ? null : d);
                setQuery("");
              }}
              className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 ${
                isToday ? "bg-honey/15" : isSelected ? "ring-1 ring-honey/40" : ""
              }`}
            >
              <span className={`text-[13px] ${isSelected ? "font-medium text-honey" : "text-ink"}`}>
                {d}
              </span>
              <span className={`h-1 w-1 rounded-full ${hasRun ? "bg-honey" : ""}`} />
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between border-b border-border-light pb-3">
        <span className={LABEL_CLASS}>이번 달 장보기 {monthRuns.length}회</span>
        <span className="text-[16px] font-medium text-honey">{won(monthTotal)}</span>
      </div>

      {!addFlowOpen ? (
        <button
          onClick={() => setAddFlowOpen(true)}
          className="self-start text-[12px] font-medium text-honey"
        >
          + 기록 직접 추가
        </button>
      ) : (
        <div className="flex flex-col gap-3 border-b border-border-light pb-3">
          <span className={LABEL_CLASS}>언제, 어디서, 얼마 냈나요</span>
          <div className="flex gap-3">
            <Input
              variant="underline"
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              className="h-10 flex-1 px-0 text-[13px]"
            />
          </div>
          <div className="flex gap-3">
            <Input
              variant="underline"
              value={addPlace}
              onChange={(e) => setAddPlace(e.target.value)}
              placeholder="구매처 (예: 트레이더스)"
              className="h-10 flex-1 px-0 text-[13px]"
            />
            <Input
              variant="underline"
              type="number"
              inputMode="numeric"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder="금액"
              className="h-10 w-24 px-0 text-[13px]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddRecord}
              disabled={isAddPending}
              className="flex-1 rounded-xl bg-honey py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
            >
              저장하기
            </button>
            <button
              onClick={() => setAddFlowOpen(false)}
              className="flex-1 rounded-xl bg-cream py-2.5 text-[13px] font-medium text-stone"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <Input
        variant="underline"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedDay(null);
        }}
        placeholder="품목·구매처 검색"
        className="h-10 px-0 text-[13px]"
      />

      {loadError && <p className="text-[12px] text-terra">{loadError}</p>}

      <div className="flex flex-col">
        {visibleRuns.length === 0 && (
          <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">
            {searchResults ? "찾는 기록이 없어요" : "이 달의 기록이 없어요"}
          </p>
        )}
        {visibleRuns.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setOpenRun(r)}
            className={`flex items-baseline gap-2.5 py-3 text-left ${
              i > 0 ? "border-t border-border-light" : ""
            }`}
          >
            <span className="w-11 shrink-0 text-[12px] text-stone">
              {Number(r.date.slice(5, 7))}.{Number(r.date.slice(8, 10))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-[14px] text-ink">{r.place || "장보기"}</span>
              <span className="block truncate text-[12px] text-[var(--text-muted)]">
                {r.itemNames.join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-[14px] text-ink">{won(r.amount)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
