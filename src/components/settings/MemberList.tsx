"use client";

import { useState } from "react";
import { IconPlus, IconPencil } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { ManagedMemberSheet } from "@/components/settings/ManagedMemberSheet";
import type { WorkspaceMemberInfo } from "@/lib/members";

const ROLE_LABEL: Record<string, string> = {
  owner: "오너",
  member: "멤버",
  junior: "주니어",
};

type MemberRow = WorkspaceMemberInfo & { role: string };

export function MemberList({
  workspaceId,
  members,
}: {
  workspaceId: string;
  members: MemberRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-surface p-4">
        {members.map((m) => {
          const isManaged = m.member_type === "managed";
          return (
            <div key={m.id} className="flex items-center gap-3">
              <Avatar
                name={m.display_name}
                color={m.avatar_color}
                textColor={m.avatar_text_color}
                imageUrl={m.avatar_image_url}
              />
              <span className="text-[17px] font-medium text-ink">{m.display_name}</span>
              <span className="ml-auto shrink-0 text-[13px] text-stone">
                {isManaged ? "관리 프로필" : ROLE_LABEL[m.role] ?? m.role}
              </span>
              {isManaged && (
                <button onClick={() => setEditing(m)} aria-label="프로필 수정">
                  <IconPencil size={16} className="text-stone" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setAdding(true)}
        className="flex items-center justify-center gap-1.5 self-start text-[16px] font-medium text-ocean"
      >
        <IconPlus size={16} />
        구성원 추가
      </button>

      <ManagedMemberSheet
        open={adding}
        onClose={() => setAdding(false)}
        workspaceId={workspaceId}
      />
      <ManagedMemberSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        workspaceId={workspaceId}
        existing={
          editing
            ? {
                id: editing.id,
                display_name: editing.display_name,
                avatar_color: editing.avatar_color,
                avatar_image_url: editing.avatar_image_url,
                birth_year: editing.birth_year,
              }
            : null
        }
      />
    </>
  );
}
