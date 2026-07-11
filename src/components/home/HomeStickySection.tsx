"use client";

import { useState } from "react";
import Link from "next/link";
import { IconNote } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { SectionLabel } from "@/components/home/SectionLabel";
import { AddPostSheet } from "@/components/home/BoardSection";
import type { Notice } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

function daysLeft(expireAt: string | null) {
  if (!expireAt) return null;
  return Math.ceil((new Date(expireAt).getTime() - Date.now()) / 86400000);
}

export function HomeStickySection({
  workspaceId,
  currentUserId,
  stickers,
  membersById,
}: {
  workspaceId: string;
  currentUserId: string;
  stickers: Notice[];
  membersById: Record<string, WorkspaceMemberInfo>;
}) {
  const [addingSticker, setAddingSticker] = useState(false);

  return (
    <div className="flex flex-col gap-row">
      <SectionLabel icon={<IconNote size={14} />} onAdd={() => setAddingSticker(true)} addLabel="하고싶은 말 작성">
        하고싶은 말
      </SectionLabel>
      <Link href="/board" className="flex flex-col gap-row pl-section-indent">
        {stickers.length === 0 && (
          <p className={`text-[12px] ${mirror.muted}`}>등록된 하고싶은 말이 없어요</p>
        )}
        {stickers.slice(0, 3).map((s) => {
          const author = membersById[s.created_by ?? ""];
          const left = daysLeft(s.expire_at);
          return (
            <div key={s.id} className="flex flex-col gap-0.5">
              <span className={`text-[10px] ${mirror.muted}`}>
                {author?.display_name ?? "가족"}
              </span>
              <span className={`truncate text-[13px] ${mirror.secondary}`}>{s.content}</span>
              {left !== null && (
                <span className={`text-[10px] ${mirror.muted}`}>D-{Math.max(left, 0)}</span>
              )}
            </div>
          );
        })}
      </Link>

      <AddPostSheet
        open={addingSticker}
        onClose={() => setAddingSticker(false)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        fixedType="sticky"
      />
    </div>
  );
}
