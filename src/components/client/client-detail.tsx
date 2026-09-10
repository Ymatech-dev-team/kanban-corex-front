"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ChevronRight, FolderTree, Loader2, Plus, User, Wallet, X } from "lucide-react";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { useProject } from "@/lib/hooks/use-projects";
import { tasksKey } from "@/lib/hooks/use-tasks";
import { useProjectMembers, useGrantAccess, useRevokeAccess } from "@/lib/hooks/use-members";
import { useMembers } from "@/lib/hooks/use-admin";
import { useCan } from "@/lib/hooks/use-can";
import { useProjectCost, projectCostKey } from "@/lib/hooks/use-cost";
import { useBoardNav } from "@/lib/board-nav";
import { httpStatus } from "@/lib/http-error";
import { initials } from "@/lib/initials";
import { CostSummary } from "@/components/cost/cost-summary";
import { ClientMetrics } from "./client-metrics";
import { ProjetosSection } from "./projetos-section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[13px] font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function CostSection({ projectId }: { projectId: string }) {
  const cost = useProjectCost(projectId, true);
  return (
    <Section title="Custo">
      <p className="-mt-1.5 text-[11.5px] text-muted-foreground">Visível só para quem pode ver custos deste cliente.</p>
      {cost.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-[104px] animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-[104px] animate-pulse rounded-xl border border-border bg-card" />
        </div>
      ) : cost.isError ? (
        <div className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
          Não foi possível carregar o custo.{" "}
          <button
            type="button"
            onClick={() => cost.refetch()}
            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tentar de novo
          </button>
        </div>
      ) : !cost.data ||
        (cost.data.porPessoa.length === 0 &&
          cost.data.incompletos.semResponsavel +
            cost.data.incompletos.semRemuneracao +
            cost.data.incompletos.semHoras +
            cost.data.incompletos.respSemAcesso ===
            0) ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
          <Wallet className="size-4 shrink-0" />
          Sem custos ainda. Defina horas estimadas e responsáveis com remuneração.
        </div>
      ) : (
        <CostSummary data={cost.data} />
      )}
    </Section>
  );
}

function MembersSection({ projectId }: { projectId: string }) {
  const members = useProjectMembers(projectId);
  const canManage = useCan(PERMISSIONS.permissoes_conceder);
  const revoke = useRevokeAccess(projectId);
  const [revoking, setRevoking] = useState<{ id: string; name: string } | null>(null);
  const list = members.data ?? [];

  return (
    <Section title="Membros com acesso">
      {members.isLoading ? (
        <div className="h-9 w-64 animate-pulse rounded-full border border-border bg-card" />
      ) : members.isError ? (
        <div className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
          Não foi possível carregar os membros.{" "}
          <button
            type="button"
            onClick={() => members.refetch()}
            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {list.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Nenhum membro com acesso a este cliente ainda.</p>
          )}
          {list.map((m) => (
            <span
              key={m.id}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-[3px] pl-[3px] pr-2.5 text-[13px]"
            >
              <span className="flex size-6 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[10px] font-medium text-foreground">
                {m.name ? initials(m.name) : <User className="size-3 text-muted-foreground" />}
              </span>
              {m.name}
              {canManage && (
                <button
                  type="button"
                  aria-label={`Remover acesso de ${m.name}`}
                  onClick={() => setRevoking({ id: m.id, name: m.name })}
                  className="text-muted-foreground/70 outline-none transition-colors hover:text-amber focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          ))}
          {canManage && <AddAccessControl projectId={projectId} currentIds={list.map((m) => m.id)} />}
        </div>
      )}

      {revoking && (
        <Dialog open onOpenChange={(o) => !o && setRevoking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remover acesso</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Remover o acesso de <span className="text-foreground">{revoking.name}</span> a este cliente? A pessoa
              sai como responsável das tarefas do cliente (o responsável principal é reatribuído automaticamente).
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRevoking(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={revoke.isPending}
                onClick={async () => {
                  try {
                    await revoke.mutateAsync(revoking.id);
                    setRevoking(null);
                  } catch {
                    /* toast no hook */
                  }
                }}
              >
                {revoke.isPending ? "Removendo…" : "Remover acesso"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Section>
  );
}

/** Dropdown pra conceder acesso ao cliente — lista usuários da org que ainda não são membros. */
function AddAccessControl({ projectId, currentIds }: { projectId: string; currentIds: string[] }) {
  const orgUsers = useMembers(); // exige membros_ver; quem tem permissoes_conceder normalmente também tem
  const grant = useGrantAccess(projectId);
  const current = new Set(currentIds);
  const candidates = (orgUsers.data ?? []).filter((u) => !current.has(u.id));

  if (orgUsers.isError) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={grant.isPending}
        className="flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/50 px-3 py-[5px] text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {grant.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        Dar acesso
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {orgUsers.isLoading ? (
          <DropdownMenuItem disabled>Carregando…</DropdownMenuItem>
        ) : candidates.length === 0 ? (
          <DropdownMenuItem disabled>Todos os usuários já têm acesso</DropdownMenuItem>
        ) : (
          candidates.map((u) => (
            <DropdownMenuItem key={u.id} onSelect={() => grant.mutate(u.id)}>
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[10px] font-medium text-foreground">
                {initials(u.name)}
              </span>
              {u.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotFound() {
  const router = useRouter();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <FolderTree className="size-5" />
      </div>
      <div>
        <h1 className="text-base font-medium tracking-tight">Cliente não encontrado</h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Ele não existe ou você não tem acesso a ele.
        </p>
      </div>
      <Button variant="secondary" onClick={() => router.push("/clientes")}>
        Voltar para clientes
      </Button>
    </div>
  );
}

export function ClientDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const nav = useBoardNav();
  const qc = useQueryClient();
  const project = useProject(projectId);

  const status = httpStatus(project.error);
  const notFound = project.isError && (status === 404 || status === 403);

  // RF-55: perdeu acesso (ou id inexistente) → limpa o cache DAQUELE cliente (não global).
  useEffect(() => {
    if (notFound) {
      qc.removeQueries({ queryKey: tasksKey(projectId) });
      qc.removeQueries({ queryKey: ["members", projectId] });
      qc.removeQueries({ queryKey: projectCostKey(projectId) });
    }
  }, [notFound, projectId, qc]);

  if (project.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (notFound) return <NotFound />;

  if (project.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-amber">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="text-base font-medium tracking-tight">Não foi possível carregar</h1>
        <p className="max-w-xs text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
        <Button variant="secondary" onClick={() => project.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const p = project.data;
  const canSeeCost = p?.canSeeCost === true;

  function openBoard() {
    nav.request(projectId);
    router.push("/tarefas");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <div>
        <button
          type="button"
          onClick={() => router.push("/clientes")}
          className="mb-3 inline-flex items-center gap-1.5 rounded text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5" />
          Clientes
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-medium tracking-tight">{p?.name}</h1>
            {p?.description && <p className="mt-1 text-[13px] text-muted-foreground">{p.description}</p>}
          </div>
          <Button onClick={openBoard} className="shrink-0">
            Abrir quadro
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Section title="Visão geral">
        <ClientMetrics projectId={projectId} canSeeCost={canSeeCost} />
      </Section>

      {canSeeCost && <CostSection projectId={projectId} />}

      <MembersSection projectId={projectId} />

      <ProjetosSection projectId={projectId} />
      </div>
    </div>
  );
}
