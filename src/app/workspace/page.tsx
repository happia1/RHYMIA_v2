import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkspace } from "./actions";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">🏠</span>
        <h1 className="text-[20px] font-medium text-ink">가족 워크스페이스 만들기</h1>
        <p className="text-[13px] text-stone">
          가족 이름을 정하고 시작해요. 이후 설정 탭에서 초대 링크를 공유할 수 있어요.
        </p>
      </div>

      <form
        action={createWorkspace}
        className="flex w-full max-w-[320px] flex-col gap-3"
      >
        <input
          name="name"
          required
          placeholder="워크스페이스 이름 (예: 우리집)"
          className="h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-[15px] text-ink placeholder:text-stone focus:outline-none"
        />
        <input
          name="displayName"
          required
          placeholder="내 호칭 (예: 엄마)"
          className="h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-[15px] text-ink placeholder:text-stone focus:outline-none"
        />
        <button
          type="submit"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream"
        >
          시작하기
        </button>
      </form>
    </div>
  );
}
