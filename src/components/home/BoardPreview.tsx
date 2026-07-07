import Link from "next/link";
import { mirror } from "@/lib/homeTheme";
import type { Notice, ShoppingItem } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

function daysLeft(expireAt: string | null) {
  if (!expireAt) return null;
  return Math.ceil((new Date(expireAt).getTime() - Date.now()) / 86400000);
}

export function BoardPreview({
  stickers,
  shoppingItems,
  membersById,
}: {
  stickers: Notice[];
  shoppingItems: ShoppingItem[];
  membersById: Record<string, WorkspaceMemberInfo>;
}) {
  const activeShopping = shoppingItems.filter((i) => !i.is_purchased);
  const previewShopping = activeShopping.slice(0, 4);
  const restCount = activeShopping.length - previewShopping.length;

  return (
    <Link href="/board" className="grid grid-cols-2 gap-6">
      <div className="flex flex-col gap-row">
        <span className={mirror.label}>스티커</span>
        {stickers.length === 0 && (
          <p className={`text-[12px] ${mirror.muted}`}>등록된 스티커가 없어요</p>
        )}
        {stickers.slice(0, 3).map((s) => {
          const author = membersById[s.created_by ?? ""];
          const left = daysLeft(s.expire_at);
          return (
            <div key={s.id} className="flex flex-col gap-0.5">
              <span className={`text-[10px] ${mirror.muted}`}>
                {author?.display_name ?? "가족"}
              </span>
              <span className={`truncate text-[13px] ${mirror.secondary}`}>{s.content}</span>
              {left !== null && (
                <span className={`text-[10px] ${mirror.muted}`}>D-{Math.max(left, 0)}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-row">
        <span className={mirror.label}>장바구니</span>
        {previewShopping.length === 0 ? (
          <p className={`text-[12px] ${mirror.muted}`}>장바구니가 비어있어요</p>
        ) : (
          previewShopping.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-sage" />
              <span className={`truncate text-[13px] ${mirror.secondary}`}>{item.name}</span>
            </div>
          ))
        )}
        {restCount > 0 && (
          <span className={`text-[12px] ${mirror.muted}`}>외 {restCount}개</span>
        )}
      </div>
    </Link>
  );
}
