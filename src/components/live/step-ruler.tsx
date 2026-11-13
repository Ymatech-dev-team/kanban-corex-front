import type { LiveKind } from "@/lib/live-status";
import { cn } from "@/lib/utils";

const MAX_TICKS = 16;
const ALERT: LiveKind[] = ["blocked", "changes", "silent"];

/**
 * Régua de passos: uma marca por passo + "n/total" em mono. Meter do HeroUI não aceita segmentos,
 * então a régua é própria, com role="meter" e rótulo "n de total passos". [RF11, design §3.1/§4]
 */
export function StepRuler({ done, total, kind, className, hideCount = false }: {
  done: number; total: number;
  /** Estado da execução: em blocked/changes/silent a marca atual fica em alerta. */
  kind?: LiveKind;
  className?: string;
  hideCount?: boolean;
}) {
  if (!Number.isFinite(total) || total <= 0) return null;
  const safeDone = Math.min(Math.max(0, Math.floor(done)), total);
  const ticks = Math.min(total, MAX_TICKS);
  // Comprimida (> 16 passos): floor, para que só done === total encha a régua inteira.
  const filled = ticks === total ? safeDone : safeDone >= total ? ticks : Math.floor((safeDone / total) * ticks);
  const currentIndex = safeDone < total ? Math.min(filled, ticks - 1) : -1;
  const alert = !!kind && ALERT.includes(kind);
  const label = `${safeDone} de ${total} passos`;
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap align-middle", className)}>
      <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={safeDone} aria-valuetext={label} className="inline-flex gap-0.5">
        {Array.from({ length: ticks }, (_, index) => (
          <i key={index} data-tick={index < filled ? "done" : index === currentIndex ? (alert ? "alert" : "current") : "todo"} aria-hidden="true"
            className={cn("h-3 w-[5px] not-italic", index < filled ? "bg-accent" : index === currentIndex ? (alert ? "bg-warning" : "bg-accent/40") : "bg-border")} />
        ))}
      </span>
      {!hideCount && <span aria-hidden="true" className="mono text-xs text-muted">{safeDone}/{total}</span>}
    </span>
  );
}
