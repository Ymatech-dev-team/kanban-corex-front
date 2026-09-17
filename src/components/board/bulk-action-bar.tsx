"use client";

import { ChevronDown, Loader2, Trash2, X } from "lucide-react";
import type { TaskStatus } from "@sistema-tasks/contracts";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const STATUS_OPTIONS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "A fazer" },
  { status: "DOING", label: "Fazendo" },
  { status: "DONE", label: "Feito" },
];

/**
 * Barra de ações fixa da seleção múltipla. Pílula flutuante centrada; no mobile fica ACIMA da bottom-nav
 * (mesmo offset do Toaster). "Mover para" e "Excluir" só aparecem com a permissão respectiva (o backend
 * barra de novo). `pending` bloqueia reenvio (anti duplo-clique). [acoes-em-massa RF-8/12/21]
 */
export function BulkActionBar({
  count,
  canMove,
  canDelete,
  pending,
  onMoveTo,
  onDelete,
  onClear,
}: {
  count: number;
  canMove: boolean;
  canDelete: boolean;
  pending: boolean;
  onMoveTo: (status: TaskStatus) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Ações da seleção"
      className="fixed left-1/2 z-40 -translate-x-1/2 bottom-[calc(80px+env(safe-area-inset-bottom,0px))] lg:bottom-6"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg">
        <span className="px-2 text-[12.5px] font-medium tabular-nums" aria-live="polite">
          {count} {count === 1 ? "selecionada" : "selecionadas"}
        </span>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}

        {canMove && (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Mover para
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top">
              {STATUS_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.status} onSelect={() => onMoveTo(o.status)}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
            Excluir
          </button>
        )}

        <span className="h-5 w-px bg-border" aria-hidden />
        <button
          type="button"
          aria-label="Limpar seleção"
          disabled={pending}
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <X className="size-3.5" aria-hidden />
          Limpar
        </button>
      </div>
    </div>
  );
}
