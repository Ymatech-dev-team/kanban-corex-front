"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatSituationDate, type Counts, type ViewFilter } from "./agora-model";

function Count({ n, one, many, view, active, onToggle, tone }: {
  n: number; one: string; many: string; view: ViewFilter; active: ViewFilter | null; onToggle: (view: ViewFilter) => void; tone?: "warn" | "danger";
}) {
  const label = `${n} ${n === 1 ? one : many}`;
  const pressed = active === view;
  // Contagem zero não filtra nada; só continua clicável se for o filtro ativo (para o usuário poder desligá-lo).
  if (n === 0 && !pressed) return <span className="text-muted">{label}</span>;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onToggle(view)}
      className={cn(
        // Sublinhado do próprio texto (colado a ele); a área de toque de 44 px no celular é um pseudo-elemento invisível,
        // então o botão não cresce e o estado pressionado continua um destaque do tamanho do texto.
        "relative cursor-pointer border-0 bg-transparent p-0 font-bold underline decoration-dashed decoration-1 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-3 max-md:before:content-['']",
        tone === "warn" && "text-warning", tone === "danger" && "text-danger",
        pressed && "bg-foreground px-1 text-background no-underline",
      )}
    >{label}</button>
  );
}

/** Linha de situação (RF6): data/hora em mono + contagens que filtram Em andamento. */
export function SituationLine({ now, counts, view, onView, loading }: { now: Date; counts: Counts | null; view: ViewFilter | null; onView: (view: ViewFilter) => void; loading: boolean }) {
  return (
    <div aria-label="Situação" role="group" className="mt-1.5 flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5 text-[15px] max-md:gap-x-3.5 max-md:gap-y-3 max-md:text-sm">
      <span className="mono text-muted" suppressHydrationWarning>{formatSituationDate(now)}</span>
      {loading ? <Skeleton className="h-4 w-64" /> : counts && <>
        <Count n={counts.running} one="rodando" many="rodando" view="rodando" active={view} onToggle={onView} />
        <Count n={counts.waiting} one="esperando você" many="esperando você" view="voce" active={view} onToggle={onView} tone="warn" />
        <Count n={counts.silent} one="sem sinal" many="sem sinal" view="sinal" active={view} onToggle={onView} tone="danger" />
        <span className="text-muted">{counts.done} {counts.done === 1 ? "concluída" : "concluídas"} hoje</span>
      </>}
    </div>
  );
}
