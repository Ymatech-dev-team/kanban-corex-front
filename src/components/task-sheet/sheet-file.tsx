"use client";

import type { ReactNode } from "react";
import { Disclosure } from "@heroui/react";
import { SectionHeader } from "@/components/live";
import { SHEET_SECTIONS } from "./sections";

/**
 * Ficha (RF34): descrição, critérios, contexto, subtarefas, responsáveis, anexos e custo. Recolhida quando há execução
 * viva, aberta quando a tarefa não tem fluxo. O conteúdo (campos editáveis, guarda de rascunho, exclusão) é o da tarefa e vem
 * de `TaskDetailView`; esta seção só dá a moldura recolhível (HeroUI `Disclosure`).
 */
export function SheetFile({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <section id={SHEET_SECTIONS.file.id} aria-labelledby={`${SHEET_SECTIONS.file.id}-title`} tabIndex={-1} className="scroll-mt-20 outline-none">
      <Disclosure isExpanded={open} onExpandedChange={onOpenChange}>
        <SectionHeader
          id={`${SHEET_SECTIONS.file.id}-title`}
          title="Ficha"
          right={
            <Disclosure.Trigger className="inline-flex min-h-6 items-center gap-1.5 text-xs text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11">
              Descrição, critérios, anexos e custo
              <Disclosure.Indicator className="size-3.5 transition-transform duration-150 motion-reduce:transition-none" />
            </Disclosure.Trigger>
          }
        />
        <Disclosure.Content>
          <Disclosure.Body className="pt-2">{children}</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </section>
  );
}
