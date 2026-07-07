"use client";

import { useTheme, type Theme } from "@/components/ui/ThemeProvider";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템 설정" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
            theme === opt.value ? "bg-ink text-cream" : "bg-cream text-stone"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
