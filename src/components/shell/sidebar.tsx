"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useMe } from "@/lib/hooks/use-me";
import { api } from "@/lib/api";
import { initials } from "@/lib/initials";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";
import { useNavItems, isNavActive, type NavItem } from "./use-nav-items";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sdt_sidebar_collapsed";

/** Sidebar do DESKTOP (≥ lg). No mobile o shell é a top bar + bottom-nav + drawer. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { primary, admin } = useNavItems();
  const me = useMe();
  const accountName = me.data?.name?.trim() || "Minha conta";
  const [collapsed, setCollapsed] = useState(false);

  // Lê a preferência só no cliente (evita mismatch de hidratação).
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      /* localStorage indisponível — segue expandida */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* sem persistência, tudo bem */
      }
      return next;
    });
  }

  async function logout() {
    await api.post("/auth/logout");
    router.push("/login");
  }

  const item = (n: NavItem) => {
    const on = isNavActive(pathname, n.href);
    const Icon = n.icon;
    return (
      <Link
        key={n.label}
        href={n.href}
        title={collapsed ? n.label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg text-[13.5px] text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          collapsed ? "justify-center px-0 py-2" : "px-2.5 py-2",
          on && "bg-accent text-foreground [&_svg]:text-primary",
        )}
      >
        <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
        {!collapsed && n.label}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "hidden flex-none flex-col border-r border-border bg-card/40 p-3 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[60px]" : "w-[236px]",
      )}
    >
      {/* Marca — wordmark COREX. (expandida) / símbolo (recolhida) */}
      <div className={cn("pb-4 pt-4", collapsed ? "flex justify-center" : "px-2")}>
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/icons/icon-192.png" alt="Corex" className="size-7 rounded-md" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/corex-logo-wordmark.png" alt="Corex" className="h-8 w-auto" />
        )}
      </div>

      <nav className="flex flex-col gap-0.5">
        {primary.map((n) => item(n))}

        {admin.length > 0 && (
          <>
            {collapsed ? (
              <div className="my-1.5 border-t border-border" />
            ) : (
              <div className="px-2 pb-1.5 pt-4 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Administração
              </div>
            )}
            {admin.map((n) => item(n))}
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-3">
        {/* Ações: notificações, tema, recolher/expandir — acima do perfil. */}
        <div className={cn("flex items-center justify-center gap-1", collapsed && "flex-col")}>
          <NotificationsBell />
          <ThemeToggle />
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" strokeWidth={1.8} />
            ) : (
              <PanelLeftClose className="size-[18px]" strokeWidth={1.8} />
            )}
          </button>
        </div>

        {/* Perfil + sair */}
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <Link
            href="/conta"
            title={collapsed ? accountName : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-lg outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
              collapsed ? "p-1" : "flex-1 p-1.5",
              pathname.startsWith("/conta") && "bg-accent",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[11px] font-medium",
                pathname.startsWith("/conta")
                  ? "border-muted-foreground/40 bg-accent text-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {me.data?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.data.avatarUrl} alt="" className="size-full object-cover" />
              ) : me.data?.name ? (
                initials(me.data.name)
              ) : (
                <User className="size-4" />
              )}
            </span>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[12.5px] font-medium">{accountName}</div>
                <div className="text-[11px] text-muted-foreground">Ver conta</div>
              </div>
            )}
          </Link>
          <button
            onClick={logout}
            title="Sair"
            aria-label="Sair"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-[17px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </aside>
  );
}
