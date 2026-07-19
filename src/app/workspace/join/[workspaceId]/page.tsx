import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { joinWorkspace } from "../../actions";

export default async function JoinWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspaceId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: workspaceName } = await supabase.rpc("get_workspace_name", {
    target_workspace_id: workspaceId,
  });

  if (!workspaceName) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <p className="text-[18px] text-ink">유효하지 않은 초대 링크예요.</p>
      </div>
    );
  }

  // 비로그인 상태 — 예전엔 곧장 /login으로 튕겨서 초대 링크 자체를 잃어버렸다(로그인 후
  // 기본 목적지인 /home으로 가버림). 대신 어느 가족에 초대됐는지 먼저 보여주고, 로그인/
  // 회원가입 버튼에 이 페이지 경로를 redirect 파라미터로 실어 보낸다 — 완료되면 로그인
  // 페이지(signInAction/signUpAction의 afterAuth)가 그 경로로 되돌려보내 자동으로 이
  // 화면(→ 참여 폼)까지 이어진다.
  if (!user) {
    const returnTo = `/workspace/join/${workspaceId}`;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
        <div className="mb-10 flex flex-col items-center gap-2 text-center">
          <span className="text-4xl">👋</span>
          <h1 className="text-[24px] font-medium text-ink">{workspaceName}에 초대됐어요</h1>
          <p className="text-[16px] text-stone">계속하려면 로그인하거나 새로 가입해주세요.</p>
        </div>
        <div className="flex w-full max-w-[320px] flex-col gap-3">
          <Link
            href={`/login?mode=signup&redirect=${encodeURIComponent(returnTo)}`}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[18px] font-medium text-cream"
          >
            회원가입하고 참여하기
          </Link>
          <Link
            href={`/login?mode=login&redirect=${encodeURIComponent(returnTo)}`}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-border-light text-[18px] font-medium text-ink"
          >
            이미 계정이 있어요
          </Link>
        </div>
      </div>
    );
  }

  async function handleJoin(formData: FormData) {
    "use server";
    const displayName = String(formData.get("displayName") ?? "").trim();
    if (!displayName) return;
    const result = await joinWorkspace(workspaceId, displayName);
    if (!result.ok) {
      redirect(`/workspace/join/${workspaceId}?error=${encodeURIComponent(result.message)}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">👋</span>
        <h1 className="text-[24px] font-medium text-ink">
          {workspaceName}에 참여하기
        </h1>
        <p className="text-[16px] text-stone">가족 안에서 나를 부르는 호칭을 알려주세요.</p>
      </div>

      <form action={handleJoin} className="flex w-full max-w-[320px] flex-col gap-3">
        <Input
          name="displayName"
          required
          placeholder="내 호칭 (예: 첫째)"
          className="h-12 w-full rounded-2xl px-4 text-[18px]"
        />
        {error && <p className="text-[16px] text-terra">{error}</p>}
        <button
          type="submit"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[18px] font-medium text-cream"
        >
          참여하기
        </button>
      </form>
    </div>
  );
}
