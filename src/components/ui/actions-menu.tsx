"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ActionItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  /** Ação destrutiva: vai pro fim, depois de um separador. Fica NEUTRA — o vermelho vive no ConfirmDialog. */
  danger?: boolean;
  /** Ação visível mas indisponível (ex.: Projeto geral): item focável, com motivo inline (não `title`). */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Menu de ações reutilizável (kebab de 3 pontos). Some quando não há nenhuma ação. O trigger para a propagação
 * (pointer/click/teclado) pra não disparar o gesto de um card clicável em volta. [crud-kebab]
 */
export function ActionsMenu({
  label,
  items,
  className,
}: {
  label: string;
  items: ActionItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  // destrutivas por último, separadas por uma linha
  const ordered = [...items.filter((i) => !i.danger), ...items.filter((i) => i.danger)];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "relative flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {/* área de toque 44px sem inflar o ícone */}
          <span aria-hidden className="absolute -inset-2" />
          <MoreVertical className="size-[17px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {ordered.map((item, i) => {
          const Icon = item.icon;
          const needsSeparator = item.danger && i > 0 && !ordered[i - 1].danger;
          if (item.disabled) {
            return (
              <React.Fragment key={item.key}>
                {needsSeparator && <DropdownMenuSeparator />}
                {/* focável (não some do leitor de tela), mas não faz nada — mostra o motivo */}
                <DropdownMenuItem
                  aria-disabled="true"
                  onSelect={(e) => e.preventDefault()}
                  className="cursor-default flex-col items-start gap-0.5 text-muted-foreground/60 focus:bg-accent/40 focus:text-muted-foreground/60"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                  {item.disabledReason && <span className="pl-6 text-[11px] leading-tight">{item.disabledReason}</span>}
                </DropdownMenuItem>
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={item.key}>
              {needsSeparator && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => item.onSelect()}>
                <Icon className="size-4 text-muted-foreground" />
                {item.label}
              </DropdownMenuItem>
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
