"use client";

import { IconMapPin } from "@tabler/icons-react";

// TODO: 카카오 로컬 API 키가 발급되면 이 텍스트 입력을 실제 장소 자동완성 검색으로
// 교체합니다. value/onChange 시그니처는 그대로 유지해 교체 범위를 이 파일로 한정합니다.
export function PlaceInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-border-light px-3 py-2.5">
      <IconMapPin size={18} className="shrink-0 text-ocean" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="장소 (선택)"
        className="h-6 flex-1 bg-transparent text-[13px] text-ink placeholder:text-stone focus:outline-none"
      />
    </label>
  );
}
