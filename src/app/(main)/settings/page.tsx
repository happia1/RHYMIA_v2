import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { requireWorkspaceContext } from "@/lib/workspace";
import { mapWorkspaceMembers } from "@/lib/members";
import { Avatar } from "@/components/ui/Avatar";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { AvatarUploader } from "@/components/settings/AvatarUploader";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { ShareLinkSection } from "@/components/settings/ShareLinkSection";
import { signOut } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  owner: "오너",
  member: "멤버",
  junior: "주니어",
};

export default async function SettingsPage() {
  const { supabase, user, workspaceId, role } = await requireWorkspaceContext();

  const [{ data: workspace }, { data: memberRows }] = await Promise.all([
    supabase.from("family_workspace").select("*").eq("id", workspaceId).single(),
    supabase
      .from("workspace_member")
      .select("user_id, display_name, role, users(avatar_color, avatar_text_color, avatar_image_url)")
      .eq("workspace_id", workspaceId)
      .order("role", { ascending: true }),
  ]);

  const rawRows = memberRows ?? [];
  const members = mapWorkspaceMembers(rawRows).map((m, i) => ({
    ...m,
    role: rawRows[i].role as string,
  }));

  const me = members.find((m) => m.user_id === user.id);

  return (
    <div className="flex flex-col gap-6 px-4 pb-6 pt-6">
      <div className="flex flex-col gap-1">
        <header className="flex h-8 items-center gap-2">
          <Link href="/home" aria-label="뒤로가기">
            <IconArrowLeft size={22} className="text-ink" />
          </Link>
          <h1 className="text-[20px] font-medium text-ink">설정</h1>
        </header>
        <p className="text-[13px] text-stone">{workspace?.name}</p>
      </div>

      <section className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-stone">내 프로필</span>
        <div className="rounded-2xl border border-border-light bg-surface p-4">
          <AvatarUploader
            userId={user.id}
            displayName={me?.display_name ?? "가족"}
            avatarColor={me?.avatar_color ?? "#E1F5EE"}
            avatarTextColor={me?.avatar_text_color ?? "#0F6E56"}
            avatarImageUrl={me?.avatar_image_url ?? null}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-stone">화면 모드</span>
        <ThemeToggle />
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-stone">가족 구성원</span>
        <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-surface p-4">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3">
              <Avatar
                name={m.display_name}
                color={m.avatar_color}
                textColor={m.avatar_text_color}
                imageUrl={m.avatar_image_url}
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
        <ShareLinkSection
          workspaceId={workspaceId}
          shareToken={workspace?.share_token ?? ""}
          isOwner={role === "owner"}
        />
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-stone">플랜</span>
        <div className="rounded-2xl border border-border-light bg-surface p-4">
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
          className="flex h-11 w-full items-center justify-center rounded-2xl bg-surface text-[15px] font-medium text-terra"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
