"use client";

import { useRouter } from "next/navigation";
import { IconToolsKitchen2 } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { MealSummaryCard, type MealSummaryItem } from "@/components/home/MealSummaryCard";

export function HomeMealSection({
  meals,
  defaultDate,
}: {
  meals: MealSummaryItem[];
  defaultDate: string;
}) {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-1.5">
      <SectionLabel
        icon={<IconToolsKitchen2 size={14} />}
        onAdd={() => router.push(`/food/add?date=${defaultDate}`)}
        addLabel="끼니 추가"
      >
        오늘 뭐먹지
      </SectionLabel>
      <div className="pl-section-indent">
        <MealSummaryCard meals={meals} />
      </div>
    </section>
  );
}
