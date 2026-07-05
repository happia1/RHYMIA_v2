"use client";

import { useEffect, useState } from "react";

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={onClose}
      onTransitionEnd={() => {
        if (!open) setMounted(false);
      }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-white p-6 transition-transform duration-200 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-[#E8E6E0]" />
        {children}
      </div>
    </div>
  );
}
