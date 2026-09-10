"use client";

import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  CheckSquare,
  Loader2,
  Pencil,
  Plus,
  Square,
  Star,
  UserMinus,
  UserPlus,
} from "lucide-react";
import type { TaskActivity } from "@/lib/types";
import { useTaskActivity } from "@/lib/hooks/use-task-activity";

const STATUS_LABEL: Record<string, string> = { TODO: "A fazer", DOING: "Fazendo", DONE: "Feito" };
const FIELD_LABEL: Record<string, string> = {
  title: "título",
  description: "descrição",
  priority: "prioridade",
  dueDate: "prazo",
};

function icon(type: string): ReactNode {
  const cls = "size-[11px] text-muted-foreground";
  switch (type) {
    case "CREATED": return <Plus className={cls} aria-hidden />;
    case "STATUS_CHANGED": return <ArrowLeftRight className={cls} aria-hidden />;
    case "FIELD_EDITED": return <Pencil className={cls} aria-hidden />;
    case "ASSIGNEE_ADDED": return <UserPlus className={cls} aria-hidden />;
    case "ASSIGNEE_REMOVED": return <UserMinus className={cls} aria-hidden />;
    case "PRIMARY_CHANGED": return <Star className={cls} aria-hidden />;
    case "SUBTASK_DONE": return <CheckSquare className={cls} aria-hidden />;
    default: return <Square className={cls} aria-hidden />;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Descreve o evento em texto (interpolação — React escapa, sem HTML bruto). [SEC-303] */
function describe(e: TaskActivity, nameOf: (id: string) => string): ReactNode {
  const who = <span className="font-medium">{e.actorName}</span>;
  const p = e.payload;
  // nome do alvo: prefere o snapshot gravado no payload; senão resolve ao vivo pelos membros. [review #2]
  const target = str(p.name) ?? nameOf(str(p.userId) ?? "");
  switch (e.type) {
    case "CREATED":
      return <>{who} criou a tarefa</>;
    case "STATUS_CHANGED": {
      const from = STATUS_LABEL[str(p.from) ?? ""] ?? str(p.from) ?? "?";
      const to = STATUS_LABEL[str(p.to) ?? ""] ?? str(p.to) ?? "?";
      return <>{who} moveu de <span className="text-muted-foreground">{from}</span> para <span className="text-muted-foreground">{to}</span></>;
    }
    case "FIELD_EDITED": {
      const fields = Array.isArray(p.fields) ? (p.fields as string[]).map((f) => FIELD_LABEL[f] ?? f) : [];
      return <>{who} editou {fields.length ? fields.join(", ") : "a tarefa"}</>;
    }
    case "ASSIGNEE_ADDED":
      return <>{who} adicionou <span className="font-medium">{target}</span> como responsável</>;
    case "ASSIGNEE_REMOVED":
      return <>{who} removeu <span className="font-medium">{target}</span> dos responsáveis</>;
    case "PRIMARY_CHANGED":
      return <>{who} tornou <span className="font-medium">{target}</span> responsável principal</>;
    case "SUBTASK_ADDED":
      return <>{who} adicionou a subtarefa <span className="text-muted-foreground">&quot;{str(p.title)}&quot;</span></>;
    case "SUBTASK_DONE":
      return <>{who} concluiu a subtarefa <span className="text-muted-foreground">&quot;{str(p.title)}&quot;</span></>;
    case "SUBTASK_REMOVED":
      return <>{who} removeu uma subtarefa</>;
    default:
      return <>{who} atualizou a tarefa</>;
  }
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }), // mostra o ano quando não é o ano corrente [review #3]
    hour: "2-digit",
    minute: "2-digit",
  });
}
function whenFull(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

export function ActivityTab({
  taskId,
  membersById,
  enabled,
}: {
  taskId: string;
  membersById: Record<string, string>;
  enabled: boolean;
}) {
  const q = useTaskActivity(taskId, enabled);
  const nameOf = (id: string) => membersById[id] ?? "alguém sem acesso";
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-[13px] text-muted-foreground">
        Não foi possível carregar a atividade.{" "}
        <button
          type="button"
          onClick={() => q.refetch()}
          className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tentar de novo
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-[13px] text-muted-foreground">Sem atividade registrada ainda.</p>;
  }

  return (
    <div>
      <div className="relative pl-6">
        <div className="absolute bottom-1 left-[8px] top-1 w-px bg-border" />
        {items.map((e) => (
          <div key={e.id} className="relative mb-3.5 last:mb-0">
            <span className="absolute -left-6 flex size-[18px] items-center justify-center rounded-full border border-border bg-card">
              {icon(e.type)}
            </span>
            <div className="text-[12.5px] text-foreground">{describe(e, nameOf)}</div>
            <time dateTime={e.createdAt} title={whenFull(e.createdAt)} className="mt-0.5 block text-[11px] text-muted-foreground">
              {when(e.createdAt)}
            </time>
          </div>
        ))}
      </div>

      {q.hasNextPage && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
