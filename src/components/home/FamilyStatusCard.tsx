import { Avatar } from "@/components/ui/Avatar";

export interface FamilyMemberStatus {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  emoji: string;
  statusText: string;
}

export function FamilyStatusCard({ members }: { members: FamilyMemberStatus[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4">
      <span className="text-[11px] font-medium text-stone">지금 우리 가족은</span>

      <div className="flex flex-col gap-3">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3">
            <Avatar
              name={m.display_name}
              color={m.avatar_color}
              textColor={m.avatar_text_color}
            />
            <span className="text-[14px] font-medium text-ink">{m.display_name}</span>
            <span className="truncate text-[13px] text-stone">{m.statusText}</span>
            <span className="ml-auto shrink-0 text-[16px]">{m.emoji}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
