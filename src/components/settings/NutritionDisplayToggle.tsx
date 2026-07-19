"use client";

import { useState, useTransition } from "react";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { updateNutritionDisplayEnabled } from "@/app/(main)/settings/actions";

/** 끄면 끼니 카드 "약 {kcal}", 식탁 탭 하루 합계 줄, 끼니 상세 "영양 정보 (추정)" 섹션이
 * 전부 숨겨진다 — 저장된 추정치 자체는 지워지지 않고 다시 켜면 그대로 보인다. */
export function NutritionDisplayToggle({
  workspaceId,
  enabled,
}: {
  workspaceId: string;
  enabled: boolean;
}) {
  const [checked, setChecked] = useState(enabled);
  const [, startTransition] = useTransition();

  const handleToggle = () => {
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      try {
        const result = await updateNutritionDisplayEnabled(workspaceId, next);
        if (!result.ok) setChecked(!next);
      } catch {
        setChecked(!next);
      }
    });
  };

  return (
    <label className="flex items-center justify-between text-[16px] text-ink">
      영양 정보 표시
      <CheckToggle checked={checked} onChange={handleToggle} size={22} />
    </label>
  );
}
