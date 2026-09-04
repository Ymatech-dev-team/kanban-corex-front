"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Building2, FolderTree, Loader2, AlertTriangle } from "lucide-react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useBoardNav } from "@/lib/board-nav";
import { CreateProjectDialog } from "@/components/board/create-project-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "clientes" | "projetos";

export default function ClientesPage() {
  const router = useRouter();
  const nav = useBoardNav();
  const projects = useProjects();
  const [tab, setTab] = useState<Tab>("clientes");
  const [createOpen, setCreateOpen] = useState(false);

  function openBoard(projectId: string) {
    nav.request(projectId);
    router.push("/tarefas");
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
        {/* Abas Clientes | Projetos (Projetos preparado pro futuro) */}
        <div className="mb-5 flex w-fit gap-0.5 rounded-lg border border-border bg-card p-[3px] text-[12.5px]">
          {([
            { key: "clientes", label: "Clientes" },
            { key: "projetos", label: "Projetos" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                tab === t.key ? "bg-accent text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "clientes" ? (
          <ClientesTab
            state={projects}
            onCreate={() => setCreateOpen(true)}
            onOpen={openBoard}
          />
        ) : (
          <ProjetosTab />
        )}
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

function ProjetosTab() {
  return (
    <Centered>
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <FolderTree className="size-5" />
      </div>
      <div>
        <h2 className="text-base font-medium tracking-tight">Projetos por cliente — em breve</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Aqui cada cliente vai poder ter vários projetos, e as tarefas ficarão organizadas por projeto dentro do
          cliente. A estrutura já está preparada para isso.
        </p>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 py-16 text-center">{children}</div>;
}
