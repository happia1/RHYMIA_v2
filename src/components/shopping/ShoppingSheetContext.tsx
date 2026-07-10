"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { GlobalShoppingSheet } from "./GlobalShoppingSheet";

const ShoppingSheetContext = createContext<{ open: () => void } | null>(null);

/** 어느 탭에서든(DockBar, 홈 미리보기 등) 글로벌 장바구니 시트를 열기 위한 훅. */
export function useShoppingSheet() {
  const ctx = useContext(ShoppingSheetContext);
  if (!ctx) {
    throw new Error("useShoppingSheet은 ShoppingSheetProvider 안에서만 사용할 수 있어요.");
  }
  return ctx;
}

export function ShoppingSheetProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <ShoppingSheetContext.Provider value={{ open }}>
      {children}
      <GlobalShoppingSheet workspaceId={workspaceId} open={isOpen} onClose={close} />
    </ShoppingSheetContext.Provider>
  );
}
