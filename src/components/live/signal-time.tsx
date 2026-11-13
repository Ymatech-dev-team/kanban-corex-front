"use client";

import { formatClock, formatSince } from "@/lib/format-since";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";

/**
 * Último sinal: relativo ("há 3 min") + hora em mono, em <time dateTime>. Renova a cada 30 s. [RF11]
 * `now` fixa o relógio (testes, listas que já têm um useNow compartilhado).
 */
export function SignalTime({ iso, now, alert = false, stack = false, className }: { iso: string | null | undefined; now?: Date; alert?: boolean; stack?: boolean; className?: string }) {
  const ticking = useNow(now ? 0 : 30_000); // relógio vindo por prop: sem timer próprio
  if (!iso || Number.isNaN(Date.parse(iso))) return <span className={cn("mono text-muted", className)}>—</span>;
  const relative = formatSince(iso, now ?? ticking);
  // Em "ontem HH:MM" e "DD mmm" o texto já situa o dia; a hora só acompanha o relativo recente.
  const recent = relative === "agora" || relative.startsWith("há ");
  return (
    <time dateTime={iso} suppressHydrationWarning className={cn("mono whitespace-nowrap", stack ? "inline-flex flex-col items-end" : "inline-flex items-baseline gap-1.5", className)}>
      <span suppressHydrationWarning className={cn(alert ? "font-medium text-danger" : "text-foreground")}>{relative}</span>
      {recent && <span suppressHydrationWarning className="text-[11px] text-muted">{stack ? formatClock(iso) : `· ${formatClock(iso)}`}</span>}
    </time>
  );
}
