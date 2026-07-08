"use client";

import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { AgentSheet } from "./AgentSheet";
import { AGENT_BUTTON_SIZE } from "@/lib/uiTokens";
import type { AgentMemberOption } from "@/lib/agentApi";

export function AgentLauncher({
  workspaceId,
  members,
}: {
  workspaceId: string;
  members: AgentMemberOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="일정 등록 에이전트 열기"
        className="fixed bottom-[148px] right-6 z-40 flex items-center justify-center rounded-full border border-honey/30 bg-honey/10 text-honey shadow-sm backdrop-blur-md"
        style={{ width: AGENT_BUTTON_SIZE, height: AGENT_BUTTON_SIZE }}
      >
        <IconSparkles size={20} />
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
