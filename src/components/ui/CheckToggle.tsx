"use client";

import { IconCheck } from "@tabler/icons-react";

export function CheckToggle({
  checked,
  onChange,
  size = 24,
}: {
  checked: boolean;
  onChange: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors ${
        checked ? "bg-sage text-white" : "bg-[#E8E6E0] text-transparent"
      }`}
      style={{ width: size, height: size }}
    >
      <IconCheck size={size * 0.6} stroke={2.5} />
    </button>
  );
}
