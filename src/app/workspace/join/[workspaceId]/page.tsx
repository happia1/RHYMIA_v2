import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinWorkspace } from "../../actions";

export default async function JoinWorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login`);

  const { data: workspaceName } = await supabase.rpc("get_workspace_name", {
    target_workspace_id: workspaceId,
  });

  if (!workspaceName) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <p className="text-[15px] text-ink">유효하지 않은 초대 링크예요.</p>
      </div>
    );
  }

  async function handleJoin(formData: FormData) {
    "use server";
    const displayName = String(formData.get("displayName") ?? "").trim();
    if (!displayName) return;
    await joinWorkspace(workspaceId, displayName);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">👋</span>
        <h1 className="text-[20px] font-medium text-ink">
          {workspaceName}에 참여하기
        </h1>
        <p className="text-[13px] text-stone">가족 안에서 나를 부르는 호칭을 알려주세요.</p>
      </div>

      <form action={handleJoin} className="flex w-full max-w-[320px] flex-col gap-3">
        <input
          name="displayName"
          required
          placeholder="내 호칭 (예: 첫째)"
          className="h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-[15px] text-ink placeholder:text-stone focus:outline-none"
        />
        <button
          type="submit"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream"
        >
          참여하기
        </button>
      </form>
    </div>
  );
}
