import { Alert } from "@heroui/react";
import { Button } from "@/components/ui/button";

/** Estados vazios e de erro: texto à esquerda (título + uma linha), ação abaixo; sem ícone em moldura. */
function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-start gap-3 px-4 py-10 text-left lg:px-6">{children}</div>;
}

/** Esqueleto do quadro (3 colunas). */
export function BoardSkeleton() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-6 md:grid-cols-3">
      {[0, 1, 2].map((c) => (
        <div key={c} className="flex flex-col gap-2.5">
          <div className="mb-1 h-4 w-24 rounded-sm bg-card" />
          {[0, 1].map((i) => (
            <div key={i} className="h-[70px] animate-pulse rounded-sm border border-border bg-card" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Esqueleto em linhas, para a Lista e o Calendário. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando tarefas" className="flex flex-1 flex-col px-4 py-4 lg:px-6">
      <span className="sr-only">Carregando tarefas…</span>
      <div className="mb-2 h-3 w-40 rounded-sm bg-surface-tertiary" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border py-3.5">
          <div className="h-3.5 w-20 animate-pulse rounded-sm bg-surface-tertiary" />
          <div className="h-3.5 flex-1 animate-pulse rounded-sm bg-surface-tertiary" />
          <div className="hidden h-3.5 w-32 animate-pulse rounded-sm bg-surface-tertiary md:block" />
          <div className="hidden h-3.5 w-24 animate-pulse rounded-sm bg-surface-tertiary lg:block" />
        </div>
      ))}
    </div>
  );
}

export function EmptyClients({ onCreate }: { onCreate: () => void }) {
  return (
    <Notice>
      <div>
        <h2 className="text-lg font-bold tracking-tight">Nenhum cliente ainda</h2>
        <p className="mt-1 max-w-md text-sm text-muted">Crie o primeiro cliente para começar a organizar as tarefas.</p>
      </div>
      <Button className="max-md:min-h-11" onClick={onCreate}>Criar primeiro cliente</Button>
    </Notice>
  );
}

export function EmptyTasks({ onAdd }: { onAdd: () => void }) {
  return (
    <Notice>
      <div>
        <h2 className="text-base font-bold tracking-tight">Sem tarefas neste projeto</h2>
        <p className="mt-1 max-w-md text-sm text-muted">Adicione a primeira tarefa deste projeto.</p>
      </div>
      <Button className="max-md:min-h-11" onClick={onAdd}>Criar primeira tarefa</Button>
    </Notice>
  );
}

export function BoardError({ onRetry }: { onRetry: () => void }) {
  return (
    <Notice>
      <Alert status="danger" role="alert" className="w-full max-w-xl">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Não foi possível carregar</Alert.Title>
          <Alert.Description>Verifique sua conexão e tente de novo.</Alert.Description>
        </Alert.Content>
      </Alert>
      <Button variant="secondary" className="max-md:min-h-11" onClick={onRetry}>
        Tentar de novo
      </Button>
    </Notice>
  );
}
