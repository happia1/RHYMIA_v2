"use client";

import { useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";

interface MemberOption {
  user_id: string;
  display_name: string;
}

export function AddEventEntry({
  workspaceId,
  members,
  defaultDate,
  autoOpen,
}: {
  workspaceId: string;
  members: MemberOption[];
  defaultDate: string;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[84px] right-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream"
        aria-label="일정 등록"
      >
        <IconPlus size={26} />
      </button>
      <AddEventSheet
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
        members={members}
        defaultDate={defaultDate}
      />
    </>
  );
}
