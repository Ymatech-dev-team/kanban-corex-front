import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";

/** Shell das páginas protegidas: no desktop, sidebar + conteúdo; no mobile (< lg), top bar +
 *  conteúdo + bottom-nav (em coluna e em fluxo, pra não cobrir o scroll das telas). [shell-mobile] */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar />
          <main className="app-dots relative flex min-h-0 flex-1 flex-col">
            {/* Aurora âmbar decorativa (só dark) atrás do conteúdo. [fundo-aurora] */}
            <div className="app-aurora" aria-hidden="true">
              <div className="app-aurora__blob app-aurora__blob--1" />
              <div className="app-aurora__blob app-aurora__blob--2" />
              <div className="app-aurora__blob app-aurora__blob--3" />
            </div>
            <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </AuthGuard>
  );
}
