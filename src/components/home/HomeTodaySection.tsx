"use client";

import { useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { TodayEvents } from "@/components/home/TodayEvents";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import type { Schedule } from "@/types";

export function HomeTodaySection({
  todaySchedules,
  members,
  workspaceId,
  defaultDate,
}: {
  todaySchedules: Schedule[];
  members: { id: string; display_name: string }[];
  workspaceId: string;
  defaultDate: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-label-gap">
      <SectionLabel icon={<IconCalendar size={14} />} onAdd={() => setAdding(true)} addLabel="일정 등록">
        오늘 뭐하지
      </SectionLabel>
      <div className="pl-section-indent">
        <TodayEvents todaySchedules={todaySchedules} />
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
