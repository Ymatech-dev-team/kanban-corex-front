"use client";

import { useState } from "react";
import { Loader2, Plus, Star, User, X } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Member } from "@/lib/types";
import { initials } from "@/lib/initials";
import { useAddAssignee, useRemoveAssignee, useSetPrimaryAssignee } from "@/lib/hooks/use-tasks";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function Avatar({ name, primary }: { name: string | null; primary?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-foreground",
        primary ? "ring-2 ring-primary" : "border border-muted-foreground/40",
      )}
    >
      {name ? initials(name) : <User className="size-3 text-muted-foreground" />}
    </span>
  );
}

type Vars = { taskId: string; userId: string; engagementId?: string };
type Mut = UseMutationResult<unknown, unknown, Vars, unknown>;

/** Gestão de responsáveis: principal (Task.assigneeId) + extras. Mutações imediatas. [detalhe-tarefa A1] */
export function AssigneesEditor({
  taskId,
  projectId,
  engagementId,
  assigneeId,
  extraAssigneeIds,
  members,
  disabled,
}: {
  taskId: string;
  projectId: string;
  engagementId?: string;
  assigneeId: string | null;
  extraAssigneeIds: string[];
  members: Member[];
  disabled?: boolean;
}) {
  const add = useAddAssignee(projectId) as unknown as Mut;
  const remove = useRemoveAssignee(projectId) as unknown as Mut;
  const setPrimary = useSetPrimaryAssignee(projectId) as unknown as Mut;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? null;

  // defesa: nunca renderiza o principal também como extra (invariante A1) [review #3]
  const extras = extraAssigneeIds.filter((id) => id !== assigneeId);
  const assignedIds = new Set([...(assigneeId ? [assigneeId] : []), ...extras]);
  const available = members.filter((m) => !assignedIds.has(m.id));
  const anyPending = pendingId !== null; // trava concorrência; feedback é por-chip

  function act(userId: string, mut: Mut) {
    setPendingId(userId);
    mut.mutate({ taskId, userId, engagementId }, { onSettled: () => setPendingId(null) });
  }

  function Chip({ id, primary }: { id: string; primary: boolean }) {
    const name = nameOf(id);
    const pending = pendingId === id;
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-border bg-card py-[3px] pl-[3px] pr-2.5 text-[12.5px]">
        <Avatar name={name} primary={primary} />
        <span className={cn(name ? "text-foreground" : "italic text-muted-foreground")}>
          {name ?? "sem acesso ao cliente"}
        </span>
        {primary && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
            principal
          </span>
        )}
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          !disabled && (
            <>
              {!primary && (
                <button
                  type="button"
                  aria-label={`Tornar ${name ?? "responsável"} principal`}
                  title="Tornar principal"
                  disabled={anyPending}
                  onClick={() => act(id, setPrimary)}
                  className="text-muted-foreground/70 transition-colors hover:text-amber disabled:opacity-40"
                >
                  <Star className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Remover ${name ?? "responsável"}`}
                disabled={anyPending}
                onClick={() => act(id, remove)}
                className="text-muted-foreground/70 transition-colors hover:text-amber disabled:opacity-40"
              >
                <X className="size-3.5" />
              </button>
            </>
          )
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {assigneeId && <Chip id={assigneeId} primary />}
      {extras.map((id) => (
        <Chip key={id} id={id} primary={false} />
      ))}
      {!assigneeId && extras.length === 0 && (
        <span className="text-[13px] text-muted-foreground">Sem responsável</span>
      )}
      {!disabled && available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={anyPending}
            className="flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/50 px-3 py-[5px] text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {add.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Adicionar
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            {available.map((m) => (
              <DropdownMenuItem key={m.id} onSelect={() => act(m.id, add)}>
                <Avatar name={m.name} />
                {m.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
