"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleCheck, MessageSquare } from "lucide-react";
import { useMyWorkflowActions } from "@/lib/hooks/use-workflow";
import { httpStatus } from "@/lib/http-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PendingActions() {
  const query = useMyWorkflowActions();
  const router = useRouter();
  const actions = query.data?.pages.flatMap((page) => page.actions) ?? [];
  // Disabled deployments expose no workflow endpoint. Do not turn this into an empty queue.
  if (query.isError && httpStatus(query.error) === 404) return null;
  return (
    <section aria-labelledby="pending-actions-title" className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="size-4 text-primary" aria-hidden="true" />
        <h2 id="pending-actions-title" className="text-sm font-medium">Precisa de você</h2>
        {!query.isError && query.data && actions.length > 0 && <span className="text-xs text-muted-foreground">{actions.length}</span>}
      </div>
      {query.isLoading ? <div role="status" aria-label="Carregando suas pendências" className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
        : query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Não foi possível consultar suas pendências.</p><Button variant="secondary" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}>Tentar novamente</Button></div>
          : !actions.length ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleCheck aria-hidden="true" className="size-4" />{query.hasNextPage ? "Nenhuma pendência nesta página." : "Nenhuma decisão pendente para você."}</p>
            : <ul className="divide-y divide-border">{actions.map((action) => <li key={action.id}><button type="button" onClick={() => router.push(`/tarefas/${encodeURIComponent(action.taskId)}?from=%2F`, { scroll: false })} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-md py-3 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0"><span className="block break-words text-sm">{action.question}</span><span className="mt-1 block text-xs text-muted-foreground">Abrir tarefa e contexto</span></span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" /></button></li>)}</ul>}
      {!query.isError && query.hasNextPage && <Button className="mt-3" variant="ghost" size="sm" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Carregar mais pendências</Button>}
    </section>
  );
}
