import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/shell/sidebar";

/** Shell das páginas protegidas: drawer lateral + área de conteúdo. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="app-dots relative flex min-w-0 flex-1 flex-col">
          {/* Aurora âmbar decorativa (só dark) atrás do conteúdo. [fundo-aurora] */}
          <div className="app-aurora" aria-hidden="true">
            <div className="app-aurora__blob app-aurora__blob--1" />
            <div className="app-aurora__blob app-aurora__blob--2" />
            <div className="app-aurora__blob app-aurora__blob--3" />
          </div>
          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
