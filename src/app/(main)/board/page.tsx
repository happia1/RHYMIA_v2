import { requireWorkspaceContext } from "@/lib/workspace";
import { BoardSection } from "@/components/home/BoardSection";
import { ShoppingList } from "@/components/home/ShoppingList";

export default async function BoardPage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const [{ data: notices }, { data: shoppingItems }] = await Promise.all([
    supabase
      .from("notice")
      .select("*")
      .eq("workspace_id", workspaceId)
      .or(`expire_at.is.null,expire_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("shopping_item")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("added_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-6">
      <h1 className="text-[20px] font-medium text-ink">게시판</h1>

      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-medium text-stone">스티커 · 공지 · 메모</span>
        <BoardSection
          workspaceId={workspaceId}
          notices={notices ?? []}
          currentUserId={user.id}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-medium text-stone">장바구니</span>
        <ShoppingList workspaceId={workspaceId} items={shoppingItems ?? []} />
      </div>
    </div>
  );
}
