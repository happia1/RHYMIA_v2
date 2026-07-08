"use client";

import { useState } from "react";
import { IconToolsKitchen2 } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { MealSummaryCard, type MealSummaryItem } from "@/components/home/MealSummaryCard";
import { MealQuickAddSheet } from "@/components/home/MealQuickAddSheet";

export function HomeMealSection({
  meals,
  workspaceId,
  defaultDate,
}: {
  meals: MealSummaryItem[];
  workspaceId: string;
  defaultDate: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-label-gap">
      <SectionLabel icon={IconToolsKitchen2} onAdd={() => setAdding(true)} addLabel="끼니 추가">
        오늘 뭐먹지
      </SectionLabel>
      <div className="pl-section-indent">
        <MealSummaryCard meals={meals} />
      </div>
      <MealQuickAddSheet
        open={adding}
        onClose={() => setAdding(false)}
        workspaceId={workspaceId}
        defaultDate={defaultDate}
      />
    </section>
  );
}
