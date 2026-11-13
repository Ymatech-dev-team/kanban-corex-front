"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleAlert, GitPullRequest } from "lucide-react";
import { useWorkflowMonitoring } from "@/lib/hooks/use-workflow";
import { workflowPresentation } from "@/lib/workflow-presentation";
import { httpStatus } from "@/lib/http-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function WorkflowMonitoring() {
  const query = useWorkflowMonitoring();
  const itemsById = new Map<string, NonNullable<typeof query.data>["pages"][number]["items"][number]>();
  for (const item of query.data?.pages.flatMap(page => page.items) ?? []) {
    const existing = itemsById.get(item.taskId);
    // A task can move between pages during polling. Never replace a newer snapshot with an older one.
    if (!existing || item.state.version > existing.state.version) itemsById.set(item.taskId, item);
  }
  const items = [...itemsById.values()];
  if (query.isError && httpStatus(query.error) === 404) return null;
  return <section aria-labelledby="monitoring-title" className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><h2 id="monitoring-title" className="text-base font-medium">Acompanhamento</h2><span className="text-xs text-muted-foreground">Último registro de cada tarefa</span></div>
    {query.isLoading ? <div role="status" aria-label="Carregando acompanhamento" className="flex flex-col gap-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      : query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Não foi possível consultar o acompanhamento.</p><Button variant="secondary" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}>Tentar novamente</Button></div>
      : !items.length ? <p className="py-5 text-sm text-muted-foreground">Nenhuma tarefa com fluxo para acompanhar por enquanto.</p>
      : <ul className="divide-y divide-border">{items.map(item => {
        const presentation = workflowPresentation(item.state);
        const Icon = presentation.tone === "warning" ? CircleAlert : presentation.tone === "success" ? CheckCircle2 : GitPullRequest;
        return <li key={item.taskId}><Link href={`/tarefas/${encodeURIComponent(item.taskId)}?from=%2F`} scroll={false} className="group flex min-w-0 flex-col gap-3 rounded-md py-5 outline-none transition-colors hover:bg-surface-tertiary/50 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1"><p className="truncate text-xs text-muted-foreground">{item.clientName} · {item.projectName}</p><h3 className="line-clamp-2 break-words text-sm font-medium">{item.title}</h3><p className="line-clamp-2 break-words text-sm text-muted-foreground">{presentation.next}</p></div>
          <div className="flex shrink-0 flex-col gap-2 sm:max-w-56 sm:items-end"><span className={cn("flex items-center gap-2 text-xs", presentation.tone === "warning" ? "text-amber" : presentation.tone === "success" ? "text-primary" : "text-muted-foreground")}><Icon className="size-4 shrink-0" aria-hidden="true" />{presentation.label}</span><span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="max-w-48 truncate">{presentation.agent ?? "Equipe"}</span><ArrowUpRight className="size-4" aria-hidden="true" /></span><time dateTime={item.updatedAt} className="text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleString("pt-BR")}</time></div>
        </Link></li>;
      })}</ul>}
    {!query.isError && query.hasNextPage && <Button variant="ghost" size="sm" className="self-start" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Carregar mais tarefas</Button>}
  </section>;
}
