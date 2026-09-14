"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavItems, isNavActive } from "./use-nav-items";
import { cn } from "@/lib/utils";

/** Barra de navegação inferior (mobile). Em FLUXO (flex-none) — reserva altura e nunca cobre o
 *  conteúdo/scroll das telas. Fundo sólido (a aurora fica atrás). [shell-mobile] */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { primary } = useNavItems();

  return (
    <nav
      aria-label="Navegação principal"
      className="flex flex-none items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {primary.map((n) => {
        const on = isNavActive(pathname, n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.label}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 pt-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              on ? "text-primary [&_svg]:text-primary" : "text-muted-foreground",
            )}
          >
            {/* ponteiro de ativo — barra fina no topo (amarelo só como ponteiro, cor contida) */}
            {on && <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />}
            <Icon className="size-[22px]" strokeWidth={1.8} />
            <span className="text-[10.5px] leading-none">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
