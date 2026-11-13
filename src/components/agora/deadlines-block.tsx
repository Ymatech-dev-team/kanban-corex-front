"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SectionHeader } from "@/components/live";
import { useAllTasks } from "@/lib/hooks/use-all-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BlockError } from "./block-error";
import { buildDeadlines, endOfWeekSunday, isAccessDenied, type DeadlineRow } from "./agora-model";
import { sheetHref } from "./open-sheet";

/**
 * Prazos (RF14). `GET /tasks` exige `tarefas.ver_globais`: quem renderiza este componente só o faz com a permissão
 * (decisão conservadora: sem ela, Prazos não existe, em vez de ficar em erro permanente e disparar o interceptor de 403).
 */
export function DeadlinesBlock({ now }: { now: Date }) {
  const tasks = useAllTasks({ dueTo: endOfWeekSunday(now).toISOString(), limit: "20" });
  const projects = useProjects();
  const clientNames = useMemo(() => new Map((projects.data ?? []).map(project => [project.id, project.name])), [projects.data]);
  const denied = tasks.isError && isAccessDenied(tasks.error);
  const rows = useMemo(() => buildDeadlines(denied ? [] : tasks.data?.tasks ?? [], now), [tasks.data, denied, now]);
  return <DeadlinesView rows={rows} clientNames={clientNames} loading={tasks.isLoading} error={tasks.isError} denied={denied} retrying={tasks.isFetching} onRetry={() => void tasks.refetch()} />;
}

/** Apresentação: até 8, vencidas em alerta; some se vazio. */
function DeadlinesView({ rows, clientNames, loading, error, denied, retrying, onRetry }: {
  rows: DeadlineRow[]; clientNames: Map<string, string>; loading: boolean; error: boolean; /** Erro 401/403/404: sem dado antigo. */ denied: boolean; retrying: boolean; onRetry: () => void;
}) {
  const failed = error && (denied || rows.length === 0);
  if (!loading && !error && rows.length === 0) return null;
  return (
    <section aria-labelledby="h-prazo" className="mt-9">
      <SectionHeader title="Prazos" id="h-prazo" right="vencidas e desta semana" />
      {loading ? <div role="status" aria-label="Carregando prazos" className="space-y-2.5 py-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-2/3" /></div>
        : failed ? <BlockError message="Não foi possível consultar os prazos." onRetry={onRetry} retrying={retrying} />
        : <>
          {error && <BlockError message="Não foi possível atualizar. Mostrando o último estado carregado." onRetry={onRetry} retrying={retrying} />}
          <dl className="m-0 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3.5 gap-y-1 text-[13px]">
            {rows.map(({ task, label, overdue }) => {
              const client = clientNames.get(task.projectId);
              return (
                <div key={task.id} className="contents">
                  <dt className={cn("mono py-0.5 text-xs", overdue ? "font-medium text-warning" : "text-muted")}>
                    {label}{overdue && <span className="sr-only"> (vencida)</span>}
                  </dt>
                  <dd className="m-0 min-w-0 break-words py-0.5">
                    <Link href={sheetHref(task.id)} scroll={false} className="underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:inline-block max-md:py-2">{task.title}</Link>
                    {client && <span className="text-muted"> · {client}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>}
    </section>
  );
}
