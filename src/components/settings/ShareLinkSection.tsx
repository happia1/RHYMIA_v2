"use client";

import { useState, useTransition } from "react";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { regenerateShareToken } from "@/app/(main)/settings/actions";

export function ShareLinkSection({
  workspaceId,
  shareToken,
  isOwner,
}: {
  workspaceId: string;
  shareToken: string;
  isOwner: boolean;
}) {
  const [token, setToken] = useState(shareToken);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleRegenerate = () => {
    setError("");
    startTransition(async () => {
      try {
        const result = await regenerateShareToken(workspaceId);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setToken(result.shareToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "재발급에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <CopyLinkButton path={`/share/${token}`} />
      {isOwner && (
        <button
          onClick={handleRegenerate}
          disabled={isPending}
          className="self-start text-[12px] font-medium text-terra"
        >
          링크 재발급 (기존 링크 무효화)
        </button>
      )}
      {error && <p className="text-[12px] text-terra">{error}</p>}
    </div>
  );
}
