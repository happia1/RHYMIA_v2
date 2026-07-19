"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { IconPlus, IconX, IconCheck, IconMicrophone } from "@tabler/icons-react";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { addShoppingItem, deleteShoppingItem, toggleShoppingPurchased } from "@/app/(main)/home/actions";
import { getShoppingItems, completeGroceryRun } from "@/app/(main)/shopping/actions";
import { SHOPPING_DOT_SIZE } from "@/lib/uiTokens";
import type { ShoppingItem } from "@/types";

const LABEL_CLASS = "text-[12px] tracking-[0.12em] font-medium text-stone";

// 타입 정의가 없는 브라우저 전용 API라 최소한의 형태만 다룬다.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const SWIPE_DELETE_THRESHOLD = -56;

/** 메모장처럼 항목을 탭하면 체크(취소선), 왼쪽으로 스와이프하거나 x를 누르면 삭제. */
function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    swiped.current = false;
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) swiped.current = true;
    setDragX(Math.min(0, delta));
  };
  const handlePointerUp = () => {
    if (dragX < SWIPE_DELETE_THRESHOLD) onDelete();
    setDragX(0);
    startX.current = null;
  };

  return (
    <div
      onClick={() => {
        if (!swiped.current) onToggle();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ transform: dragX ? `translateX(${dragX}px)` : undefined }}
      className="flex cursor-pointer items-center gap-2 transition-transform"
    >
      <span
        style={{ width: SHOPPING_DOT_SIZE, height: SHOPPING_DOT_SIZE }}
        className={`flex shrink-0 items-center justify-center rounded-full ${
          item.is_purchased ? "bg-sage text-white" : "bg-border-light"
        }`}
      >
        {item.is_purchased && <IconCheck size={SHOPPING_DOT_SIZE * 0.6} stroke={2.5} />}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[14px] ${
          item.is_purchased ? "text-[var(--text-muted)] line-through" : "text-ink"
        }`}
      >
        {item.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="삭제"
      >
        <IconX size={16} className="text-[var(--text-muted)]" />
      </button>
    </div>
  );
}

/** "장볼 것" 관리 패널 — 입력(+음성)/체크리스트/"장보기 완료" 흐름 전체를 담당한다.
 * 모바일 전역 시트(GlobalShoppingSheet)와 태블릿 식탁 탭 아코디언(펼친 장바구니)이
 * 이 컴포넌트를 그대로 공유한다(중복 구현 금지) — 마운트될 때 자체적으로 목록을
 * 불러오므로 호출부는 workspaceId만 넘기면 된다. */
export function ShoppingListPanel({ workspaceId }: { workspaceId: string }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [groceryFlowOpen, setGroceryFlowOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const refresh = () => {
    getShoppingItems(workspaceId)
      .then(setItems)
      .catch(() => {});
  };

  useEffect(() => {
    setSpeechSupported(typeof window !== "undefined" && "webkitSpeechRecognition" in window);
    refresh();
    return () => {
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor = (
      window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    ).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // 아직 장보기 완료로 묶이지 않은(expense_id가 없는) 항목만 "장볼 것" 목록에 남는다 —
  // 체크(is_purchased)해도 바로 사라지지 않고 취소선으로 표시된 채 목록에 남아 있다가,
  // "장보기 완료"를 눌러야 expense로 묶이며 이 목록에서 빠지고 "기록" 탭으로 넘어간다.
  const active = items.filter((i) => !i.expense_id);
  const checked = active.filter((i) => i.is_purchased);

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft("");
    startTransition(async () => {
      await addShoppingItem(workspaceId, value);
      refresh();
    });
  };

  const handleToggle = (item: ShoppingItem) => {
    startTransition(async () => {
      await toggleShoppingPurchased(item.id, !item.is_purchased);
      refresh();
    });
  };

  const handleDelete = (itemId: string) => {
    startTransition(async () => {
      await deleteShoppingItem(itemId);
      refresh();
    });
  };

  const handleCompleteGroceryRun = () => {
    const itemIds = checked.map((i) => i.id);
    if (itemIds.length === 0) return;
    startTransition(async () => {
      const result = await completeGroceryRun(workspaceId, {
        itemIds,
        place: place.trim() || null,
        amount: amount ? Number(amount) : null,
        addToFridge: true,
      });
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      setGroceryFlowOpen(false);
      setPlace("");
      setAmount("");
      refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          variant="underline"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={speechSupported ? "살 것을 입력하거나 음성으로 등록하세요" : "살 것을 입력하세요"}
          className="h-11 flex-1 px-0 text-[14px]"
        />
        {speechSupported && (
          <button
            onClick={handleMicClick}
            aria-label={isListening ? "음성 인식 중지" : "음성으로 입력"}
            type="button"
          >
            <IconMicrophone size={20} className={isListening ? "text-honey" : "text-[var(--text-muted)]"} />
          </button>
        )}
        <button onClick={handleAdd} aria-label="추가" disabled={isPending}>
          <IconPlus size={22} className="text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {active.length === 0 && <p className="text-[16px] text-[var(--text-muted)]">장바구니가 비어있어요</p>}
        {active.map((item) => (
          <ShoppingItemRow
            key={item.id}
            item={item}
            onToggle={() => handleToggle(item)}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-border-light pt-3">
        {!groceryFlowOpen ? (
          <button
            disabled={checked.length === 0}
            onClick={() => setGroceryFlowOpen(true)}
            className={`flex h-11 items-center justify-center rounded-xl border text-[17px] font-medium ${
              checked.length > 0 ? "border-honey text-honey" : "border-border-light text-[var(--text-muted)]"
            }`}
          >
            장보기 완료{checked.length > 0 && ` · ${checked.length}개`}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <span className={LABEL_CLASS}>어디서, 얼마 냈나요</span>
            <div className="flex gap-3">
              <Input
                variant="underline"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="구매처 (예: 트레이더스)"
                className="h-10 flex-1 px-0 text-[16px]"
              />
              <Input
                variant="underline"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="금액"
                className="h-10 w-24 px-0 text-[16px]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCompleteGroceryRun}
                disabled={isPending}
                className="flex-1 rounded-xl bg-honey py-2.5 text-[16px] font-medium text-white disabled:opacity-50"
              >
                기록하기
              </button>
              <button
                onClick={() => setGroceryFlowOpen(false)}
                className="flex-1 rounded-xl bg-cream py-2.5 text-[16px] font-medium text-stone"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
