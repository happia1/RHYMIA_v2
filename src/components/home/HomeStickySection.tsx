"use client";

import { useState } from "react";
import Link from "next/link";
import { IconNote } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { SectionLabel } from "@/components/home/SectionLabel";
import { AddPostSheet } from "@/components/home/BoardSection";
import type { Notice } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

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

  const previewStickers = stickers.slice(0, 3);
  const restCount = stickers.length - previewStickers.length;

  return (
    <div className="flex flex-col gap-row">
      <SectionLabel icon={<IconNote size={14} />} onAdd={() => setAddingSticker(true)} addLabel="하고싶은 말 작성">
        하고싶은 말
      </SectionLabel>
      <Link href="/board" className="flex flex-col gap-row pl-section-indent">
        {previewStickers.length === 0 && (
          <p className={`text-[11px] ${mirror.muted}`}>등록된 하고싶은 말이 없어요</p>
        )}
        {previewStickers.map((s) => {
          const author = membersById[s.created_by ?? ""];
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`truncate text-[12px] ${mirror.secondary}`}>{s.content}</span>
                <span className={`self-end text-[9px] ${mirror.muted}`}>
                  {author?.display_name ?? "가족"}
                </span>
              </div>
              {s.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image_url} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
              )}
            </div>
          );
        })}
        {restCount > 0 && (
          <span className={`self-end text-[11px] ${mirror.muted}`}>외 {restCount}개</span>
        )}
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
