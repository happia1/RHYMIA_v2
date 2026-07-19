import { requireWorkspaceContext } from "@/lib/workspace";
import { DockBar } from "@/components/ui/DockBar";
import { ShoppingSheetProvider } from "@/components/shopping/ShoppingSheetContext";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = await requireWorkspaceContext();

  return (
    <ShoppingSheetProvider workspaceId={workspaceId}>
      <div className="min-h-screen bg-cream pb-[var(--dock-h)]">
        {children}
        <DockBar />
      </div>
    </ShoppingSheetProvider>
  );
}
