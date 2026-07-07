import { requireWorkspaceContext } from "@/lib/workspace";
import { DockBar } from "@/components/ui/DockBar";
import { ToastProvider } from "@/components/ui/Toast";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspaceContext();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-cream pb-[64px]">
        {children}
        <DockBar />
      </div>
    </ToastProvider>
  );
}
