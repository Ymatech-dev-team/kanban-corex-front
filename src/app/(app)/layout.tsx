import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/shell/sidebar";

/** Shell das páginas protegidas: drawer lateral + área de conteúdo. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="app-dots flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </AuthGuard>
  );
}
