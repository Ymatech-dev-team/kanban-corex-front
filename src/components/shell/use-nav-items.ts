"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, ListChecks, Building2, Users, ShieldCheck, type LucideIcon } from "lucide-react";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { useCan } from "@/lib/hooks/use-can";
import { readStoredClientProject } from "@/lib/global-filters";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Ativo por FRONTEIRA de segmento (evita /clientesX casar /clientes) e ignora a query do href. */
export function isNavActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
}

/**
 * Fonte ÚNICA da navegação — Sidebar (desktop), bottom-nav e drawer (mobile) consomem isto.
 * O href de "Tarefas" é dinâmico (carrega o filtro Cliente/Projeto lembrado), por isso é hook. [shell-mobile]
 */
export function useNavItems(): { primary: NavItem[]; admin: NavItem[] } {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canTarefasGlobais = useCan(PERMISSIONS.tarefas_ver_globais);
  const canMembers = useCan(PERMISSIONS.membros_gerenciar);
  const canRoles = useCan(PERMISSIONS.perfis_gerenciar);

  const [tarefasHref, setTarefasHref] = useState("/tarefas");
  useEffect(() => {
    const src =
      pathname === "/tarefas"
        ? { cliente: searchParams.get("cliente") || undefined, projeto: searchParams.get("projeto") || undefined }
        : readStoredClientProject();
    if (!src.cliente) {
      setTarefasHref("/tarefas");
      return;
    }
    const p = new URLSearchParams({ cliente: src.cliente });
    if (src.projeto) p.set("projeto", src.projeto);
    setTarefasHref(`/tarefas?${p.toString()}`);
  }, [pathname, searchParams]);

  const primary: NavItem[] = [
    { href: "/", label: "Início", icon: Home },
    ...(canTarefasGlobais ? [{ href: tarefasHref, label: "Tarefas", icon: ListChecks }] : []),
    { href: "/clientes", label: "Clientes", icon: Building2 },
  ];
  const admin: NavItem[] = [
    ...(canMembers ? [{ href: "/admin/membros", label: "Membros", icon: Users }] : []),
    ...(canRoles ? [{ href: "/admin/perfis", label: "Perfis e permissões", icon: ShieldCheck }] : []),
  ];
  return { primary, admin };
}
