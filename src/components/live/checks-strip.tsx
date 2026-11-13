import type { ReviewCheck } from "@sistema-tasks/contracts";
import { cn } from "@/lib/utils";

const WORD = { passed: "passou", failed: "falhou", pending: "pendente" } as const;
const MARK = { passed: "✓", failed: "✗", pending: "…" } as const;

/** Os checks da revisão em células mono. Falhou = sublinhado + texto "falhou" (leitor de tela) + ✗, nunca só cor. */
export function ChecksStrip({ checks, className, label = "Checks da revisão" }: { checks: Pick<ReviewCheck, "name" | "status">[]; className?: string; label?: string }) {
  if (!checks.length) return null;
  return (
    <ul aria-label={label} className={cn("mono m-0 inline-flex list-none border border-border p-0 text-[11px]", "rounded-xs", className)}>
      {checks.map(check => (
        <li key={check.name} data-status={check.status}
          className={cn("border-r border-border px-2 py-1 last:border-r-0", check.status === "passed" && "text-success", check.status === "failed" && "text-danger underline decoration-2 underline-offset-2", check.status === "pending" && "text-muted")}>
          {check.name} <span aria-hidden="true">{MARK[check.status]}</span><span className="sr-only"> {WORD[check.status]}</span>
        </li>
      ))}
    </ul>
  );
}
