"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/components/schedule/Chip";

/** 일정 탭 필터 — 이제 [전체] + 멤버(managed 포함) 한 줄뿐이다. Fridge에 올라오는 일정은
 * 전부 가족 공유가 전제라 공유/개인 스코프 구분 자체를 없앴다(schedule/page.tsx 참고).
 * 하루 탭의 요일 칩과 같은 Chip 컴포넌트를 재사용 — 사람 구분은 아바타 색 점으로. */
export function MemberFilterRow({
  members,
  target,
}: {
  members: { id: string; display_name: string; avatar_color: string }[];
  target: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setTarget = (value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete("target");
    else next.set("target", value);
    router.push(`/schedule?${next.toString()}`);
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      <Chip label="전체" active={target === "all"} onClick={() => setTarget(null)} />
      {members.map((m) => (
        <Chip
          key={m.id}
          label={m.display_name}
          color={m.avatar_color}
          active={target === m.id}
          onClick={() => setTarget(m.id)}
        />
      ))}
    </div>
  );
}
