import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cabeçalho de seção: régua de 2px + título + contagem em mono + slot à direita. `alert` pinta a régua de âmbar. */
export function SectionHeader({ title, count, right, alert = false, level = 2, id, className }: {
  title: string; count?: number; right?: ReactNode; alert?: boolean; level?: 2 | 3; id?: string; className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <header data-alert={alert ? "" : undefined} className={cn("mb-1.5 flex items-baseline gap-3 border-t-2 pt-2.5", alert ? "border-warning" : "border-[color:var(--rule)]", className)}>
      <Heading id={id} className="text-[15px] font-bold">{title}</Heading>
      {count != null && <span className="mono text-xs text-muted">{count}</span>}
      {right != null && <div className="ml-auto text-xs text-muted">{right}</div>}
    </header>
  );
}
