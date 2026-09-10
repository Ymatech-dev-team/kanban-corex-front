"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  CheckSquare,
  Loader2,
  Pencil,
  Plus,
  Square,
  Star,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import type { TaskActivity } from "@/lib/types";
import {
  useTaskActivity,
  useAddComment,
  useEditComment,
  useDeleteComment,
  idemKey,
} from "@/lib/hooks/use-task-activity";
import { initials } from "@/lib/initials";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function draftKey(taskId: string) {
  return `sdt_cdraft_${taskId}`;
}
function loadDraft(taskId: string): string {
  try {
    return localStorage.getItem(draftKey(taskId)) ?? "";
  } catch {
    return "";
  }
}

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
  const add = useAddComment(taskId);
  const edit = useEditComment(taskId);
  const del = useDeleteComment(taskId);
  const nameOf = (id: string) => membersById[id] ?? "alguém sem acesso";
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const sendKey = useRef<string | null>(null); // chave de idempotência estável por tentativa [review C2]

  // rascunho por tarefa: carrega ao abrir, persiste ao digitar (não perde ao fechar o modal). [RF-J3]
  useEffect(() => {
    setDraft(loadDraft(taskId));
    setFailed(false);
    setEditing(null);
    setConfirmDel(null);
    sendKey.current = null;
  }, [taskId]);
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(draftKey(taskId), draft);
      else localStorage.removeItem(draftKey(taskId));
    } catch {
      /* sem localStorage: segue sem persistir */
    }
  }, [draft, taskId]);

  async function submit() {
    const body = draft.trim();
    if (!body || add.isPending) return;
    if (!sendKey.current) sendKey.current = idemKey(); // reenvio reusa a MESMA chave (não duplica)
    try {
      await add.mutateAsync({ body, key: sendKey.current });
      setDraft("");
      setFailed(false);
      sendKey.current = null; // sucesso → próxima mensagem terá chave nova
    } catch {
      setFailed(true); // mantém o rascunho E a chave pra reenviar [RF-J4]
    }
  }
  async function saveEdit() {
    if (!editing || edit.isPending) return;
    const body = editing.body.trim();
    if (!body) return;
    try {
      await edit.mutateAsync({ commentId: editing.id, body });
      setEditing(null);
    } catch {
      /* toast no hook; mantém em edição */
    }
  }

  return (
    <div className="flex flex-col">
      <div className="min-h-[60px]">
        {q.isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : q.isError ? (
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
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Sem atividade ainda. Comente abaixo.</p>
        ) : (
          <div className="relative pl-6">
            <div className="absolute bottom-1 left-[8px] top-1 w-px bg-border" />
            {items.map((e) =>
              e.type === "COMMENT" ? (
                <div key={e.id} className="relative mb-3.5 last:mb-0">
                  <span className="absolute -left-[26px] flex size-[22px] items-center justify-center rounded-full bg-accent text-[10px] font-medium text-foreground">
                    {initials(e.actorName)}
                  </span>
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[12.5px] font-medium">{e.actorName}</span>
                      <time
                        dateTime={e.createdAt}
                        title={whenFull(e.createdAt)}
                        className="text-[11px] text-muted-foreground"
                      >
                        {when(e.createdAt)}
                        {e.editedAt ? " · editado" : ""}
                      </time>
                      {e.canManage && e.body !== null && editing?.id !== e.id && (
                        <span className="ml-auto flex gap-1">
                          <button
                            type="button"
                            aria-label="Editar comentário"
                            onClick={() => setEditing({ id: e.id, body: e.body ?? "" })}
                            className="rounded-sm text-muted-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remover comentário"
                            onClick={() => setConfirmDel(e.id)}
                            className="rounded-sm text-muted-foreground/70 outline-none transition-colors hover:text-amber focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    {editing?.id === e.id ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editing.body}
                          onChange={(ev) => setEditing({ id: e.id, body: ev.target.value })}
                          maxLength={5000}
                          className="min-h-[60px]"
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                            Cancelar
                          </Button>
                          <Button type="button" onClick={saveEdit} disabled={!editing.body.trim() || edit.isPending}>
                            {edit.isPending ? "Salvando…" : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    ) : e.body === null ? (
                      <p className="text-[13px] italic text-muted-foreground">comentário removido</p>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-[13px] text-foreground">{e.body}</p>
                    )}
                    {confirmDel === e.id && (
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                        Remover este comentário?
                        <button
                          type="button"
                          disabled={del.isPending}
                          onClick={() => {
                            del.mutate(e.id);
                            setConfirmDel(null);
                          }}
                          className="rounded-sm font-medium text-destructive outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                          Remover
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDel(null)}
                          className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={e.id} className="relative mb-3.5 last:mb-0">
                  <span className="absolute -left-6 flex size-[18px] items-center justify-center rounded-full border border-border bg-card">
                    {icon(e.type)}
                  </span>
                  <div className="text-[12.5px] text-foreground">{describe(e, nameOf)}</div>
                  <time
                    dateTime={e.createdAt}
                    title={whenFull(e.createdAt)}
                    className="mt-0.5 block text-[11px] text-muted-foreground"
                  >
                    {when(e.createdAt)}
                  </time>
                </div>
              ),
            )}

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
        )}
      </div>

      {/* composer — comentar exige acesso ao cliente (garantido no backend); barra real lá. [RF-C1/C6] */}
      <div className="mt-3 border-t border-border pt-3">
        <Textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (failed) setFailed(false);
          }}
          maxLength={5000}
          placeholder="Escrever um comentário"
          className="min-h-[60px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {failed ? (
            <span className="flex items-center gap-1.5 text-[12px] text-amber">
              <X className="size-3.5" /> Não enviado — tente de novo
            </span>
          ) : (
            <span />
          )}
          <Button type="button" onClick={submit} disabled={!draft.trim() || add.isPending}>
            {add.isPending ? "Enviando…" : failed ? "Reenviar" : "Comentar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
