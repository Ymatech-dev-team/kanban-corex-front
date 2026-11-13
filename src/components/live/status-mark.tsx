import type { LiveKind } from "@/lib/live-status";
import { cn } from "@/lib/utils";

/**
 * Forma do estado: a forma E o texto carregam o sinal, nunca só a cor. [RF4]
 * cheio = rodando · vazado tracejado = sem sinal · meio cheio = revisão/ajustes/pausa · cheio de alerta = bloqueada/esperando você.
 */
const SHAPE: Record<LiveKind, string> = {
  running: "border-accent bg-accent",
  you: "border-warning bg-warning",
  silent: "border-dashed border-danger bg-transparent",
  blocked: "border-danger bg-danger",
  review: "border-accent bg-[linear-gradient(90deg,var(--accent)_50%,transparent_50%)]",
  changes: "border-warning bg-[linear-gradient(90deg,var(--warning)_50%,transparent_50%)]",
  paused: "border-muted bg-[linear-gradient(0deg,var(--muted)_50%,transparent_50%)]",
  planning: "border-muted bg-transparent",
  done: "border-muted bg-muted",
};
/** Texto em alerta usa os tokens de texto com contraste AA nos dois temas (petróleo do claro é --success, não --accent). */
const TEXT: Partial<Record<LiveKind, string>> = { silent: "text-danger", blocked: "text-danger", you: "text-warning", changes: "text-warning" };

export function StatusMark({ kind, label, className }: { kind: LiveKind; /** Texto ao lado da forma; sem ele quem usa deve renderizar o texto do estado. */ label?: string; className?: string }) {
  const mark = <span aria-hidden="true" data-kind={kind} data-status-mark="" className={cn("inline-block size-2.5 shrink-0 rounded-xs border-[1.5px] align-[-1px]", SHAPE[kind], !label && className)} />;
  if (!label) return mark;
  return <span className={cn("inline-flex items-center gap-1.5 font-semibold", TEXT[kind], className)}>{mark}<span>{label}</span></span>;
}
