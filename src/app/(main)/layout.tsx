import { requireWorkspaceContext } from "@/lib/workspace";
import { DockBar } from "@/components/ui/DockBar";
import { ShoppingSheetProvider } from "@/components/shopping/ShoppingSheetContext";
import { TabletHomeRevealProvider } from "@/components/ui/TabletHomeReveal";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = await requireWorkspaceContext();

  return (
    <ShoppingSheetProvider workspaceId={workspaceId}>
      <TabletHomeRevealProvider>
        <div className="min-h-screen bg-cream pb-[var(--dock-h)]">
          {children}
          <DockBar />
        </div>
      </TabletHomeRevealProvider>
    </ShoppingSheetProvider>
  );
}
