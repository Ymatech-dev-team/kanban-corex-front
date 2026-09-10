"use client";

import { useTasks } from "@/lib/hooks/use-tasks";
import { formatMinutesAsHours } from "@/lib/duration";

/** Card de métrica neutro, local ao detalhe (não reusa o Stat da home — evita tocar tela estável). */
function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="text-2xl font-medium tracking-tight tabular-nums">{value}</div>
      {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CardsSkeleton({ n }: { n: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-[88px] animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  );
}

export function ClientMetrics({ projectId, canSeeCost = false }: { projectId: string; canSeeCost?: boolean }) {
  const tasks = useTasks(projectId);

  if (tasks.isLoading) return <CardsSkeleton n={4} />;
  if (tasks.isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
        Não foi possível carregar as métricas.{" "}
        <button
          type="button"
          onClick={() => tasks.refetch()}
          className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const list = tasks.data ?? [];
  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Sem tarefas neste cliente ainda.
      </div>
    );
  }

  const todo = list.filter((t) => t.status === "TODO").length;
  const doing = list.filter((t) => t.status === "DOING").length;
  const done = list.filter((t) => t.status === "DONE").length;

  // Horas = insumo de custo → só quem tem custos.ver vê os cards. [SEC-custo]
  const withEst = list.filter((t) => t.estimatedMinutes != null);
  const semEst = list.length - withEst.length;
  const anyEst = withEst.length > 0;
  const totalMin = withEst.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  const openMin = withEst
    .filter((t) => t.status !== "DONE")
    .reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total de tarefas" value={list.length} />
        <MetricCard label="A fazer" value={todo} />
        <MetricCard label="Fazendo" value={doing} />
        <MetricCard label="Feito" value={done} />
      </div>
      {canSeeCost && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Horas estimadas"
            value={anyEst ? formatMinutesAsHours(totalMin) : "—"}
            hint={semEst > 0 ? `${semEst} ${semEst === 1 ? "tarefa" : "tarefas"} sem horas estimadas` : undefined}
          />
          <MetricCard
            label="Horas em aberto"
            value={anyEst ? formatMinutesAsHours(openMin) : "—"}
            hint="tarefas não concluídas"
          />
        </div>
      )}
    </div>
  );
}
