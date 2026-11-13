"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User } from "lucide-react";
import { useMe } from "@/lib/hooks/use-me";
import { api } from "@/lib/api";
import { initials } from "@/lib/initials";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";
import { useNavItems, isNavActive } from "./use-nav-items";
import { cn } from "@/lib/utils";

/** Top bar do mobile (< lg): menu (☰) + marca + sino + tema. O ☰ abre um drawer (HeroUI Modal —
 *  foco preso, scroll-lock, Esc) com Administração + conta/logout. [shell-mobile] */
export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { admin } = useNavItems();
  const me = useMe();
  const accountName = me.data?.name?.trim() || "Minha conta";
  const [open, setOpen] = useState(false);

  // Fecha ao trocar de rota e ao cruzar pra desktop (senão fica preso aberto).
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Falha de rede no logout: segue para o login; o servidor decide a sessão no próximo pedido.
    }
    // Cache é por navegador, não por usuário: limpar antes de sair evita mostrar dados da sessão anterior. [produto-telas S1]
    queryClient.clear();
    router.push("/login");
  }

  return (
    <header className="flex h-[52px] flex-none items-center gap-1 border-b border-border bg-background px-2 lg:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger variant="unstyled" asChild>
          <Button variant="unstyled"
            type="button"
            aria-label="Abrir menu"
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="size-[22px]" strokeWidth={1.8} />
          </Button>
        </DialogTrigger>

          <DialogContent placement="left" showCloseButton={false}
            aria-label="Menu"
            className="corex-sidebar flex h-dvh w-[84vw] max-w-[300px] flex-col rounded-none border-r border-border p-3"
          >
            <DialogDescription className="sr-only">Navegação e conta</DialogDescription>
            <div className="flex items-center justify-between pb-1 pl-1 pt-1">
              <DialogTitle>
                <span className="brand-plaque inline-flex items-center rounded-lg px-2.5 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/logo-dark.svg" alt="Corex" className="h-9 w-auto" />
                </span>
              </DialogTitle>
              <DialogClose variant="unstyled" asChild>
                <Button variant="unstyled"
                  type="button"
                  aria-label="Fechar menu"
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-5" />
                </Button>
              </DialogClose>
            </div>

            {admin.length > 0 && (
              <nav className="mt-3 flex flex-col gap-0.5">
                <div className="px-2 pb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Administração
                </div>
                {admin.map((n) => {
                  const on = isNavActive(pathname, n.href);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.label}
                      href={n.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13.5px] text-muted-foreground outline-none transition-colors hover:bg-surface-tertiary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                        on && "bg-surface-tertiary text-foreground [&_svg]:text-primary",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
              <Link
                href="/conta"
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 outline-none transition-colors hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-ring",
                  pathname.startsWith("/conta") && "bg-surface-tertiary",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-xs font-medium text-muted-foreground">
                  {me.data?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.data.avatarUrl} alt="" className="size-full object-cover" />
                  ) : me.data?.name ? (
                    initials(me.data.name)
                  ) : (
                    <User className="size-4" />
                  )}
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[12.5px] font-medium">{accountName}</div>
                  <div className="text-xs text-muted-foreground">Ver conta</div>
                </div>
              </Link>
              <Button variant="unstyled"
                type="button"
                onClick={logout}
                aria-label="Sair"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-surface-tertiary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="size-[18px]" strokeWidth={1.8} />
              </Button>
            </div>
          </DialogContent>

      </Dialog>

      <span className="brand-plaque ml-0.5 inline-flex items-center rounded-lg px-2 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-dark.svg" alt="Corex" className="h-7 w-auto" />
      </span>

      <div className="ml-auto flex items-center">
        <div className="flex size-11 items-center justify-center">
          <NotificationsBell />
        </div>
        <div className="flex size-11 items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
