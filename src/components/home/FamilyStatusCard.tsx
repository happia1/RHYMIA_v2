import { mirror } from "@/lib/homeTheme";

export interface FamilyMemberStatus {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
  emoji: string;
  statusText: string;
}

export function FamilyStatusCard({ members }: { members: FamilyMemberStatus[] }) {
  return (
    <div className="flex flex-col gap-row">
      {members.map((m) => (
        <div key={m.user_id} className="flex items-center gap-3">
          <span className={`w-16 shrink-0 truncate text-[13px] font-medium ${mirror.primary}`}>
            {m.display_name}
          </span>
          <span className={`min-w-0 flex-1 truncate text-[13px] ${mirror.secondary}`}>
            {m.statusText}
          </span>
          <span className="shrink-0 text-[15px]">{m.emoji}</span>
        </div>
      ))}
    </div>
  );
}
