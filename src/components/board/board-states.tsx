import { FolderPlus, ListTodo, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>;
}

export function BoardSkeleton() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-6 md:grid-cols-3">
      {[0, 1, 2].map((c) => (
        <div key={c} className="flex flex-col gap-2.5">
          <div className="mb-1 h-4 w-24 rounded bg-card" />
          {[0, 1].map((i) => (
            <div key={i} className="h-[70px] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyClients({ onCreate }: { onCreate: () => void }) {
  return (
    <Centered>
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <FolderPlus className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-medium tracking-tight">Nenhum cliente ainda</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Crie o primeiro cliente para começar a organizar as tarefas.
        </p>
      </div>
      <Button onClick={onCreate}>Criar primeiro cliente</Button>
    </Centered>
  );
}

export function EmptyTasks({ onAdd }: { onAdd: () => void }) {
  return (
    <Centered>
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <ListTodo className="size-5" />
      </div>
      <div>
        <h2 className="text-base font-medium tracking-tight">Sem tarefas neste cliente</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">Adicione a primeira tarefa para montar o quadro.</p>
      </div>
      <Button onClick={onAdd}>Criar primeira tarefa</Button>
    </Centered>
  );
}

export function BoardError({ onRetry }: { onRetry: () => void }) {
  return (
    <Centered>
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-amber">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <h2 className="text-base font-medium tracking-tight">Não foi possível carregar</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </Centered>
  );
}
