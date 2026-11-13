"use client";

import type { ReactNode } from "react";
import { Disclosure } from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * Bloco recolhível da folha (relatórios, achados longos). HeroUI `Disclosure`: o gatilho é um botão com o
 * título como nome acessível e `aria-expanded`. Sem animação de altura: só o giro do indicador (≤ 200 ms,
 * desligado com prefers-reduced-motion). [design §3.1]
 */
export function Fold({ title, children, defaultOpen, open, onOpenChange, className }: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <Disclosure
      {...(open === undefined ? { defaultExpanded: defaultOpen } : { isExpanded: open })}
      onExpandedChange={onOpenChange}
      className={cn("border-t border-border", className)}
    >
      <Disclosure.Trigger className="flex min-h-9 w-full items-center justify-between gap-3 py-2 text-left text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11">
        <span>{title}</span>
        <Disclosure.Indicator className="size-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none" />
      </Disclosure.Trigger>
      <Disclosure.Content>
        <Disclosure.Body className="pb-3 pt-1">{children}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
