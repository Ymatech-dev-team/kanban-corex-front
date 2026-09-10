import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/shell/sidebar";
import { BoardNavProvider } from "@/lib/board-nav";

/** Shell das páginas protegidas: drawer lateral + área de conteúdo. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <BoardNavProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="app-dots flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </BoardNavProvider>
    </AuthGuard>
  );
}
