"use client";

import { useEffect, useState } from "react";
import { ScrollShadow } from "@heroui/react";
import { cn } from "@/lib/utils";
import { scrollToSection } from "./sections";

/**
 * Quem rola de verdade: o ancestral mais próximo com `overflow-y` auto/scroll/overlay que está transbordando agora.
 * Não basta o contêiner "que deveria rolar": no drawer a altura pode não estar travada e quem rola é outro ancestral,
 * então medir contra um contêiner fixo daria sempre a mesma resposta. `null` = a janela.
 */
export function findScrollOwner(from: Element | null): Element | null {
  for (let node = from?.parentElement ?? null; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
  }
  return null;
}

const atBottom = (scroller: Element | null) => {
  const el = scroller ?? document.scrollingElement ?? document.documentElement;
  return el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
};

/** A seção ativa é a última cujo topo já passou desta fração da altura visível (30%). */
export const ACTIVE_LINE = 0.3;

/**
 * Seção visível (RF28), por posição e sem IntersectionObserver: no `scroll` de quem rola de verdade (`findScrollOwner`,
 * reavaliado quando o scroll vem de outro ancestral; a janela quando ninguém transborda) e no resize, a ativa é a última
 * seção cujo `top`, relativo ao topo visível do contêiner, é ≤ 30% da altura visível (ou a primeira, se nenhuma). No fim da
 * rolagem, a última. O cálculo roda no máximo uma vez por quadro (`requestAnimationFrame`).
 */
export function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const key = ids.join("|");
  useEffect(() => {
    const list = key ? key.split("|") : [];
    setActive((current) => (current && list.includes(current) ? current : list[0]));
    const first = list.map((id) => document.getElementById(id)).find((el): el is HTMLElement => !!el) ?? null;
    if (!first) return;
    let owner: Element | null = findScrollOwner(first);
    let pending = false;
    let frame = 0;
    const compute = () => {
      const top = owner ? owner.getBoundingClientRect().top : 0;
      const height = owner ? owner.clientHeight : window.innerHeight;
      let next = list[0];
      if (atBottom(owner)) next = list[list.length - 1];
      else for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - top <= height * ACTIVE_LINE) next = id;
      }
      setActive(next);
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(() => { pending = false; compute(); });
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) {
        if (!target.contains(first)) return; // rolagem de outro lugar da página
        owner = target;
      } else owner = findScrollOwner(first); // a janela rolou
      schedule();
    };
    const onResize = () => { owner = findScrollOwner(first); schedule(); };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    schedule();
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, [key]);
  return active;
}

/**
 * Índice fixo à direita (RF28): marca a seção visível e leva até a outra, rolando no mesmo contêiner. Some abaixo de 1024 px.
 * No painel lateral é mais estreito para não espremer o conteúdo.
 */
export function SheetIndex({ sections, activeId, className }: { sections: readonly { id: string; label: string }[]; activeId: string | undefined; className?: string }) {
  return (
    <nav aria-label="Seções da tarefa" className={cn("sticky top-4 hidden self-start border-l border-border text-[13px] lg:block", className)}>
      <ScrollShadow className="max-h-[calc(100dvh-8rem)]">
        <ul className="m-0 list-none p-0">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={section.id === activeId ? "location" : undefined}
                onClick={(event) => { event.preventDefault(); scrollToSection(section.id); }}
                className={cn("-ml-px block border-l-2 px-3 py-1.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none", section.id === activeId ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground")}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </ScrollShadow>
    </nav>
  );
}
