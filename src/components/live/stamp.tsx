import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = { ok: "border-success text-success", warn: "border-warning text-warning", danger: "border-danger text-danger" } as const;

/** Carimbo de decisão (aprovada, com exceção…): borda 2px, giro de -1,5° estático, sem animação. */
export function Stamp({ title, children, tone = "ok", className }: { title: string; children?: ReactNode; tone?: keyof typeof TONE; className?: string }) {
  return (
    <div data-stamp="" className={cn("inline-flex -rotate-[1.5deg] flex-col border-2 px-2.5 py-1 text-[11px] leading-[1.3]", TONE[tone], className)}>
      <b className="text-xs font-bold uppercase tracking-[.08em]">{title}</b>
      {children != null && <span className="text-[11px]">{children}</span>}
    </div>
  );
}
