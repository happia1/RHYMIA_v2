"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { IconPlus, IconX, IconCamera, IconLoader2 } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { Input } from "@/components/ui/Input";
import { mirror } from "@/lib/homeTheme";
import { toDateStr } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import {
  addShoppingItem,
  deleteShoppingItem,
  toggleShoppingPurchased,
} from "@/app/(main)/home/actions";
import { getShoppingItems, completeGroceryRun } from "@/app/(main)/shopping/actions";
import { SHOPPING_DOT_SIZE } from "@/lib/uiTokens";
import type { ShoppingItem } from "@/types";

function groupByDate(items: ShoppingItem[]) {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const date = (item.purchased_at ?? item.added_at).slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(item);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dateItems]) => ({ date, items: dateItems }));
}

function formatGroupDate(date: string) {
  const d = new Date(date);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
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
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [groceryFlowOpen, setGroceryFlowOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState("");
  const [addToFridge, setAddToFridge] = useState(true);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    getShoppingItems(workspaceId)
      .then(setItems)
      .catch(() => {});
  };

  useEffect(() => {
    if (open) refresh();
    // 열릴 때마다 다시 조회 — 다른 탭에서 바뀐 내용까지 반영하기 위해
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const todayStr = toDateStr(new Date());
  const active = items.filter((i) => !i.is_purchased);
  const purchased = items.filter((i) => i.is_purchased);
  const groups = groupByDate(purchased);
  const todayCandidates = purchased.filter(
    (i) => !i.expense_id && (i.purchased_at ?? "").slice(0, 10) === todayStr
  );

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

  const handleReceiptSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploadingReceipt(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("receipts")
        .upload(path, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from("receipts").getPublicUrl(path);
      setReceiptUrl(data.publicUrl);
    } catch {
      // 영수증은 선택 항목 — 업로드 실패해도 장보기 완료 자체는 계속 진행 가능하게 조용히 무시
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleCompleteGroceryRun = () => {
    const itemIds = todayCandidates.map((i) => i.id);
    if (itemIds.length === 0) return;
    startTransition(async () => {
      await completeGroceryRun(workspaceId, {
        itemIds,
        place: place.trim() || null,
        amount: amount ? Number(amount) : null,
        receiptImageUrl: receiptUrl,
        addToFridge,
      });
      setGroceryFlowOpen(false);
      setPlace("");
      setAmount("");
      setReceiptUrl(null);
      setAddToFridge(true);
      refresh();
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">장바구니</h2>

        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="살 것을 입력하세요"
            className="h-11 flex-1 rounded-xl px-3 text-[14px]"
          />
          <button onClick={handleAdd} aria-label="추가" disabled={isPending}>
            <IconPlus size={22} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {active.length === 0 && (
            <p className="text-[13px] text-[var(--text-muted)]">장바구니가 비어있어요</p>
          )}
          {active.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <CheckToggle
                checked={item.is_purchased}
                onChange={() => handleToggle(item)}
                size={SHOPPING_DOT_SIZE}
              />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{item.name}</span>
              <button onClick={() => handleDelete(item.id)} aria-label="삭제">
                <IconX size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
          ))}
        </div>

        {todayCandidates.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border-light pt-3">
            {!groceryFlowOpen ? (
              <button
                onClick={() => setGroceryFlowOpen(true)}
                className="flex h-11 items-center justify-center rounded-2xl bg-honey text-[14px] font-medium text-white"
              >
                장보기 완료 ({todayCandidates.length}개)
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] text-[var(--text-muted)]">
                  {todayCandidates.map((i) => i.name).join(", ")}
                </p>
                <Input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="장소 (선택)"
                  className="h-10 rounded-xl px-3 text-[13px]"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="총액 (선택)"
                  className="h-10 rounded-xl px-3 text-[13px]"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => receiptFileInputRef.current?.click()}
                    disabled={isUploadingReceipt}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-honey disabled:opacity-50"
                  >
                    {isUploadingReceipt ? (
                      <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                      <IconCamera size={16} />
                    )}
                    {receiptUrl ? "영수증 변경" : "영수증 첨부"}
                  </button>
                  {receiptUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={receiptUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  )}
                  <input
                    ref={receiptFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptSelected}
                  />
                </div>
                <label className="flex items-center justify-between text-[13px] text-ink">
                  재고에 추가
                  <CheckToggle
                    checked={addToFridge}
                    onChange={() => setAddToFridge((v) => !v)}
                    size={22}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGroceryFlowOpen(false)}
                    className="flex-1 rounded-xl bg-cream py-2.5 text-[13px] font-medium text-stone"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleCompleteGroceryRun}
                    disabled={isPending}
                    className="flex-1 rounded-xl bg-honey py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    완료
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {groups.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border-light pt-3">
            <span className={mirror.label}>구매 완료</span>
            {groups.map((g) => (
              <div key={g.date} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  {formatGroupDate(g.date)}
                </span>
                {g.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 pl-1">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)] line-through">
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
