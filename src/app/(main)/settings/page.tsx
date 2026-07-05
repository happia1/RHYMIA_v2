import { requireWorkspaceContext } from "@/lib/workspace";
import { Avatar } from "@/components/ui/Avatar";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { signOut } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  owner: "오너",
  member: "멤버",
  junior: "주니어",
};

export default async function SettingsPage() {
  const { supabase, workspaceId, role } = await requireWorkspaceContext();

  const [{ data: workspace }, { data: memberRows }] = await Promise.all([
    supabase.from("family_workspace").select("*").eq("id", workspaceId).single(),
    supabase
      .from("workspace_member")
      .select("user_id, display_name, role, users(avatar_color, avatar_text_color)")
      .eq("workspace_id", workspaceId)
      .order("role", { ascending: true }),
  ]);

  const members = (memberRows ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      user_id: m.user_id as string,
      display_name: m.display_name ?? "가족",
      role: m.role as string,
      avatar_color: u?.avatar_color ?? "#E1F5EE",
      avatar_text_color: u?.avatar_text_color ?? "#0F6E56",
    };
  });

  return (
    <div className="flex flex-col gap-6 px-4 pb-6 pt-6">
      <div>
        <h1 className="text-[20px] font-medium text-ink">설정</h1>
        <p className="text-[13px] text-stone">{workspace?.name}</p>
      </div>

      <section className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-stone">가족 구성원</span>
        <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3">
              <Avatar
                name={m.display_name}
                color={m.avatar_color}
                textColor={m.avatar_text_color}
              />
              <span className="text-[14px] font-medium text-ink">{m.display_name}</span>
              <span className="ml-auto text-[11px] text-stone">
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </div>
          ))}
        </div>
        {role === "owner" && (
          <>
            <span className="text-[12px] text-stone">아래 링크로 가족을 초대하세요</span>
            <CopyLinkButton path={`/workspace/join/${workspaceId}`} />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-stone">외부 공유</span>
        <p className="text-[12px] text-stone">
          읽기 전용 링크예요. 돌봄자·조부모에게 전달해보세요.
        </p>
        <CopyLinkButton path={`/share/${workspaceId}`} />
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-stone">플랜</span>
        <div className="rounded-2xl border border-border-light bg-white p-4">
          <p className="text-[14px] text-ink">
            {workspace?.plan === "pro" ? "Pro 플랜" : "Free 플랜"}
          </p>
          <p className="text-[12px] text-stone">
            최대 {workspace?.member_limit}인까지 함께할 수 있어요
          </p>
        </div>
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-2xl bg-white text-[13px] font-medium text-terra"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
