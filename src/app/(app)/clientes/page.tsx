"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Building2, Loader2, AlertTriangle } from "lucide-react";
import { useProjects } from "@/lib/hooks/use-projects";
import { generalEngagementId } from "@/lib/engagements";
import { CreateProjectDialog } from "@/components/board/create-project-dialog";
import { Button } from "@/components/ui/button";
export default function ClientesPage() {
  const router = useRouter();
  const projects = useProjects();
  const [createOpen, setCreateOpen] = useState(false);

  // Cliente recém-criado → abre o board do Projeto geral dele (direto, refresh-safe).
  function openBoard(projectId: string) {
    router.push(`/clientes/${projectId}/projetos/${generalEngagementId(projectId)}`);
  }

  // Clicar no card abre o DETALHE do cliente (não o quadro). [detalhe-do-cliente RF-01]
  function openDetail(projectId: string) {
    router.push(`/clientes/${projectId}`);
  }

  return (
    <>
      <header className="flex items-center gap-4 border-b border-border px-6 py-3.5">
        <div>
          <h1 className="text-base font-medium tracking-tight">Clientes</h1>
          <p className="text-[12.5px] text-muted-foreground">Cadastre e organize seus clientes.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <ClientesTab state={projects} onCreate={() => setCreateOpen(true)} onOpen={openDetail} />
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={openBoard} />
    </>
  );
}

function ClientesTab({
  state,
  onCreate,
  onOpen,
}: {
  state: ReturnType<typeof useProjects>;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  if (state.isLoading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (state.isError) {
    return (
      <Centered>
        <AlertTriangle className="size-6 text-amber" />
        <p className="text-sm text-muted-foreground">Não foi possível carregar os clientes.</p>
        <Button variant="secondary" onClick={() => state.refetch()}>
          Tentar de novo
        </Button>
      </Centered>
    );
  }
  const clients = state.data ?? [];
  if (clients.length === 0) {
    return (
      <Centered>
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <Building2 className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-medium tracking-tight">Nenhum cliente ainda</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Crie o primeiro cliente para começar a organizar as tarefas.
          </p>
        </div>
        <Button onClick={onCreate}>Criar primeiro cliente</Button>
      </Centered>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {clients.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onOpen(c.id)}
          className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-accent text-muted-foreground">
            <Building2 className="size-[18px]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium tracking-tight">{c.name}</span>
            <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted-foreground">
              {c.description || "Sem descrição"}
            </span>
          </span>
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
        </button>
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 py-16 text-center">{children}</div>;
}
