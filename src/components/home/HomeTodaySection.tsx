"use client";

import { useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { TodayEvents, type MemberInfo } from "@/components/home/TodayEvents";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import type { Schedule } from "@/types";

export function HomeTodaySection({
  todaySchedules,
  membersById,
  members,
  workspaceId,
  defaultDate,
}: {
  todaySchedules: Schedule[];
  membersById: Record<string, MemberInfo>;
  members: { user_id: string; display_name: string }[];
  workspaceId: string;
  defaultDate: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-label-gap">
      <SectionLabel icon={IconCalendar} onAdd={() => setAdding(true)} addLabel="일정 등록">
        오늘 뭐하지
      </SectionLabel>
      <div className="pl-section-indent">
        <TodayEvents todaySchedules={todaySchedules} membersById={membersById} />
      </div>
      <AddEventSheet
        open={adding}
        onClose={() => setAdding(false)}
        workspaceId={workspaceId}
        members={members}
        defaultDate={defaultDate}
      />
    </section>
  );
}
