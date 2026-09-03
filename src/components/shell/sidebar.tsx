"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Folder, Users, ShieldCheck, LogOut, User, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { useCan } from "@/lib/hooks/use-can";
import { api } from "@/lib/api";
import { NotificationsBell } from "./notifications-bell";
import { cn } from "@/lib/utils";

const MAIN = [
  { href: "/", label: "Início", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Folder },
];

const STORAGE_KEY = "sdt_sidebar_collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const canMembers = useCan(PERMISSIONS.membros_gerenciar);
  const canRoles = useCan(PERMISSIONS.perfis_gerenciar);
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

  const item = (href: string, label: string, Icon: typeof Folder) => {
    const on = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg text-[13.5px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
          collapsed ? "justify-center px-0 py-2" : "px-2.5 py-2",
          on && "bg-accent text-foreground [&_svg]:text-primary",
        )}
      >
        <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
        {!collapsed && label}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-none flex-col border-r border-border bg-card/40 p-3 transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-[236px]",
      )}
    >
      {/* Marca + sino + toggle */}
      <div
        className={cn(
          "pb-4 pt-1.5",
          collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2.5 px-2",
        )}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[15px] font-bold text-primary-foreground">
          Y
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-medium tracking-tight">Sistema de Tasks</div>
            <div className="text-[11px] text-muted-foreground">YMALOG</div>
          </div>
        )}
        <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "ml-auto")}>
          <NotificationsBell />
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
      </div>

      <nav className="flex flex-col gap-0.5">
        {MAIN.map((n) => item(n.href, n.label, n.icon))}

        {(canMembers || canRoles) && (
          <>
            {collapsed ? (
              <div className="my-1.5 border-t border-border" />
            ) : (
              <div className="px-2 pb-1.5 pt-4 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Administração
              </div>
            )}
            {canMembers && item("/admin/membros", "Membros", Users)}
            {canRoles && item("/admin/perfis", "Perfis e permissões", ShieldCheck)}
          </>
        )}
      </nav>

      <div
        className={cn(
          "mt-auto border-t border-border pt-3",
          collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2.5",
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <User className="size-4" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[12.5px] font-medium">Minha conta</div>
          </div>
        )}
        <button
          onClick={logout}
          title="Sair"
          aria-label="Sair"
          className={cn(
            "text-muted-foreground transition-colors hover:text-foreground",
            !collapsed && "ml-auto",
          )}
        >
          <LogOut className="size-[17px]" strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}
