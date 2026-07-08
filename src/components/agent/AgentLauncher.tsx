"use client";

import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { AgentSheet } from "./AgentSheet";
import { AGENT_BUTTON_SIZE } from "@/lib/uiTokens";
import type { WorkspaceMemberInfo } from "@/lib/members";

export function AgentLauncher({
  workspaceId,
  members,
}: {
  workspaceId: string;
  members: WorkspaceMemberInfo[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="일정 등록 에이전트 열기"
        className="fixed bottom-[84px] right-4 z-40 flex items-center justify-center rounded-full bg-honey text-white shadow-lg"
        style={{ width: AGENT_BUTTON_SIZE, height: AGENT_BUTTON_SIZE }}
      >
        <IconSparkles size={24} />
      </button>

      <AgentSheet
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
        members={members}
      />
    </>
  );
}
