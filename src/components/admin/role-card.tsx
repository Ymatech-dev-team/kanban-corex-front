"use client";

import { MoreHorizontal, Pencil, Trash2, Lock, ShieldCheck, Shield, KeyRound, Users } from "lucide-react";
import type { AdminRole } from "@/lib/hooks/use-admin";
import { roleConcedeAdmin, roleCoverage, type AreaCoverage } from "@/lib/permissions-catalog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Área de item único (ex.: Custos) = incluído/não, sem fração; demais mostram x/total. [redesign perfis] */
function coverageLabel(c: AreaCoverage): string {
  return c.total === 1 ? c.title : `${c.title} ${c.count}/${c.total}`;
}

/**
 * Card de um perfil na listagem admin. Apresentacional: recebe a contagem de membros pronta
 * (undefined = desconhecida, quando o viewer não tem "Ver membros" → não renderiza). [redesign perfis]
 */
export function RoleCard({
  role,
  memberCount,
  canManage,
  onEdit,
  onDelete,
}: {
  role: AdminRole;
  memberCount?: number;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const coverage = roleCoverage(role.permissions);
  const used = coverage.filter((c) => c.count > 0);
  const empty = coverage.filter((c) => c.count === 0).map((c) => c.title);
  const concedeAdmin = roleConcedeAdmin(role.permissions);

  const permText = `${role.permissions.length} ${role.permissions.length === 1 ? "permissão" : "permissões"}`;
  const memberText =
    memberCount === undefined ? null : `${memberCount} ${memberCount === 1 ? "membro" : "membros"}`;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {/* Ícone do perfil: menta só no de sistema (marcador privilegiado); personalizado fica neutro. */}
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent"
          aria-hidden
        >
          {role.isSystem ? (
            <Shield className="size-[18px] text-primary" />
          ) : (
            <Shield className="size-[18px] text-muted-foreground" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-medium tracking-tight">{role.name}</h2>
            {role.isSystem ? (
              <span className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                <Lock className="size-2.5" aria-hidden />
                sistema
              </span>
            ) : (
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                personalizado
              </span>
            )}
            {concedeAdmin && (
              <span className="flex shrink-0 items-center gap-1 rounded border border-primary/45 px-1.5 py-0.5 text-[10.5px] text-primary">
                <ShieldCheck className="size-2.5" aria-hidden />
                admin
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <KeyRound className="size-3.5" aria-hidden />
              {permText}
            </span>
            {memberText && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {memberText}
              </span>
            )}
          </div>
        </div>

        {canManage && !role.isSystem && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Ações"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-4 text-muted-foreground" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete}>
                <Trash2 className="size-4 text-muted-foreground" />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Cobertura por área — chips neutros; área completa fica mais clara (ênfase sem cor). [painel] */}
      {used.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {used.map((c) => {
            const full = c.count === c.total;
            return (
              <span
                key={c.title}
                className={cn(
                  "rounded-md border border-border px-2 py-0.5 text-[11px]",
                  full ? "text-foreground/90" : "text-muted-foreground",
                )}
              >
                {coverageLabel(c)}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mt-3.5 text-[12px] text-muted-foreground/70">Sem permissões</p>
      )}
      {used.length > 0 && empty.length > 0 && (
        <p className="mt-2 text-[11.5px] text-muted-foreground/70">Sem acesso: {empty.join(", ")}</p>
      )}

      {role.isSystem && (
        <span className="mt-3 text-[11.5px] text-muted-foreground/70">Perfil de sistema — não editável</span>
      )}
    </div>
  );
}
