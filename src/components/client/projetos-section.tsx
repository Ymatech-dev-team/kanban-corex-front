"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Users, Loader2, X, ChevronRight } from "lucide-react";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import type { Engagement } from "@/lib/types";
import {
  useEngagements,
  useCreateEngagement,
  useUpdateEngagement,
  useDeleteEngagement,
  useConsultores,
  useAddConsultor,
  useRemoveConsultor,
} from "@/lib/hooks/use-engagements";
import { useProjectMembers } from "@/lib/hooks/use-members";
import { useCan } from "@/lib/hooks/use-can";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initials } from "@/lib/initials";

export function ProjetosSection({ projectId }: { projectId: string }) {
  const router = useRouter();
  const list = useEngagements(projectId);
  const canCreate = useCan(PERMISSIONS.engagements_criar);
  const canEdit = useCan(PERMISSIONS.engagements_editar);
  const canDelete = useCan(PERMISSIONS.engagements_excluir);
  const canConsult = useCan(PERMISSIONS.engagements_consultores);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Engagement | null>(null);
  const [deleting, setDeleting] = useState<Engagement | null>(null);
  const [consultoresOf, setConsultoresOf] = useState<Engagement | null>(null);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted-foreground">Projetos</h2>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Novo projeto
          </Button>
        )}
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-[92px] animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-[92px] animate-pulse rounded-xl border border-border bg-card" />
        </div>
      ) : list.isError ? (
        <div className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
          Não foi possível carregar os projetos.{" "}
          <button
            type="button"
            onClick={() => list.refetch()}
            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(list.data ?? []).map((e) => (
            <article key={e.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  aria-label={`Abrir projeto ${e.name}`}
                  onClick={() => router.push(`/clientes/${projectId}/projetos/${e.id}`)}
                  className="group/name flex min-w-0 flex-1 items-center gap-1.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate font-medium tracking-tight">{e.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover/name:text-foreground" />
                </button>
                <div className="flex shrink-0 gap-1 text-muted-foreground">
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Editar projeto ${e.name}`}
                      onClick={() => {
                        setEditing(e);
                        setFormOpen(true);
                      }}
                      className="flex size-7 items-center justify-center rounded-md border border-border outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Pencil className="size-[15px]" />
                    </button>
                  )}
                  {canDelete &&
                    (e.isGeneral ? (
                      <span
                        title="O Projeto geral não pode ser excluído"
                        aria-disabled="true"
                        aria-label="Excluir indisponível: o Projeto geral não pode ser excluído"
                        className="flex size-7 items-center justify-center rounded-md border border-border opacity-40"
                      >
                        <Trash2 className="size-[15px]" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Excluir projeto ${e.name}`}
                        onClick={() => setDeleting(e)}
                        className="flex size-7 items-center justify-center rounded-md border border-border outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-[15px]" />
                      </button>
                    ))}
                </div>
              </div>
              {e.description && <p className="line-clamp-1 text-[12.5px] text-muted-foreground">{e.description}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                <span>{e.taskCount} {e.taskCount === 1 ? "tarefa" : "tarefas"}</span>
                <span>{e.consultorCount} {e.consultorCount === 1 ? "consultor" : "consultores"}</span>
                {canConsult && (
                  <button
                    type="button"
                    onClick={() => setConsultoresOf(e)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-sm text-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Users className="size-3.5" /> Consultores
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <EngagementFormDialog
          projectId={projectId}
          engagement={editing}
          onClose={() => setFormOpen(false)}
        />
      )}
      {deleting && (
        <DeleteEngagementDialog projectId={projectId} engagement={deleting} onClose={() => setDeleting(null)} />
      )}
      {consultoresOf && (
        <ConsultoresDialog projectId={projectId} engagement={consultoresOf} onClose={() => setConsultoresOf(null)} />
      )}
    </section>
  );
}

function EngagementFormDialog({
  projectId,
  engagement,
  onClose,
}: {
  projectId: string;
  engagement: Engagement | null;
  onClose: () => void;
}) {
  const create = useCreateEngagement(projectId);
  const update = useUpdateEngagement(projectId);
  const [name, setName] = useState(engagement?.name ?? "");
  const [description, setDescription] = useState(engagement?.description ?? "");
  const pending = create.isPending || update.isPending;

  async function save() {
    if (!name.trim()) return;
    try {
      if (engagement) {
        await update.mutateAsync({ id: engagement.id, patch: { name: name.trim(), description: description.trim() || null } });
      } else {
        await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      }
      onClose();
    } catch {
      /* toast já tratado no hook */
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{engagement ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eng-name">Nome</Label>
            <Input id="eng-name" autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eng-desc">Descrição</Label>
            <Input id="eng-desc" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={!name.trim() || pending}>
            {pending ? "Salvando…" : engagement ? "Salvar" : "Criar projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEngagementDialog({
  projectId,
  engagement,
  onClose,
}: {
  projectId: string;
  engagement: Engagement;
  onClose: () => void;
}) {
  const del = useDeleteEngagement(projectId);
  async function confirm() {
    try {
      await del.mutateAsync(engagement.id);
      onClose();
    } catch {
      /* toast no hook */
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir projeto</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Excluir o projeto <span className="text-foreground">{engagement.name}</span>
          {engagement.taskCount > 0
            ? ` e suas ${engagement.taskCount} ${engagement.taskCount === 1 ? "tarefa" : "tarefas"}?`
            : "?"}{" "}
          Isso não pode ser desfeito.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={del.isPending}>
            {del.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConsultoresDialog({
  projectId,
  engagement,
  onClose,
}: {
  projectId: string;
  engagement: Engagement;
  onClose: () => void;
}) {
  const consultores = useConsultores(engagement.id);
  const membersQuery = useProjectMembers(projectId);
  const add = useAddConsultor(engagement.id, projectId);
  const remove = useRemoveConsultor(engagement.id, projectId);

  const current = consultores.data ?? [];
  const currentIds = new Set(current.map((c) => c.id));
  const candidates = (membersQuery.data ?? []).filter((m) => !currentIds.has(m.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consultores — {engagement.name}</DialogTitle>
        </DialogHeader>

        {consultores.isLoading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : current.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhum consultor neste projeto ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {current.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                <span className="flex size-6 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[10px] font-medium text-foreground">
                  {initials(c.name)}
                </span>
                <span className="flex-1 text-[13.5px]">{c.name}</span>
                <button
                  type="button"
                  aria-label={`Remover ${c.name}`}
                  onClick={() => remove.mutate(c.id)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-1 border-t border-border pt-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">Adicionar</div>
          {membersQuery.isLoading ? (
            <p className="text-[12.5px] text-muted-foreground">Carregando membros…</p>
          ) : candidates.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              Nenhum membro do cliente disponível. Conceda acesso ao cliente primeiro.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {candidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => add.mutate(m.id)}
                  disabled={add.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[12.5px] outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <Plus className="size-3.5" /> {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
