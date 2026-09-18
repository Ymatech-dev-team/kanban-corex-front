"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import type { AdminRole } from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";

/**
 * Seletor de perfil (radiogroup acessível) — compartilhado pelos diálogos Novo/Editar membro.
 * "Sem perfil" sempre primeiro; setas navegam. [redesign membros]
 */
export function RolePicker({
  roles,
  value,
  onChange,
  ariaLabel = "Perfil",
}: {
  roles: AdminRole[];
  value: string | null;
  onChange: (id: string | null) => void;
  ariaLabel?: string;
}) {
  const options: { id: string | null; name: string; hint: string }[] = [
    { id: null, name: "Sem perfil", hint: "acesso mínimo" },
    ...roles.map((r) => ({
      id: r.id,
      name: r.name,
      hint: `${r.permissions.length} ${r.permissions.length === 1 ? "permissão" : "permissões"}`,
    })),
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIdx = options.findIndex((o) => o.id === value);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const next = (Math.max(0, selectedIdx) + dir + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} className="flex flex-col gap-1.5">
      {options.map((opt, i) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id ?? "none"}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (selectedIdx === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-muted-foreground/40 bg-accent" : "border-border hover:border-muted-foreground/30",
            )}
          >
            <span>
              <span className="font-medium">{opt.name}</span>
              <span className="ml-2 text-muted-foreground">{opt.hint}</span>
            </span>
            {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
