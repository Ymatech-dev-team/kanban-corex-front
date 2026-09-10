"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, Plus, Trash2, Loader2 } from "lucide-react";
import { PERMISSIONS, type TaskPriority, type TaskStatus, type UpdateTaskInput } from "@sistema-tasks/contracts";
import type { Member } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { dueTag, isDueUrgent } from "@/lib/due";
import { AssigneesEditor } from "./assignees-editor";
import { ActivityTab } from "./activity-tab";
import {
  useTaskDetail,
  useUpdateTask,
  useDeleteTask,
  useAddSubtask,
  useToggleSubtask,
  useDeleteSubtask,
} from "@/lib/hooks/use-tasks";
import { useCan } from "@/lib/hooks/use-can";
import { useProject } from "@/lib/hooks/use-projects";
import { useTaskCost } from "@/lib/hooks/use-cost";
import { parseHoursToMinutes, minutesToHoursInput } from "@/lib/duration";
import { formatBRL } from "@/lib/money";
import type { CostState } from "@/lib/types";
import { cn } from "@/lib/utils";

const COST_MSG: Record<Exclude<CostState, "OK">, string> = {
  SEM_HORAS: "Defina as horas estimadas para calcular.",
  SEM_RESPONSAVEL: "Defina um responsável para calcular.",
  SEM_REMUNERACAO: "O responsável não tem remuneração cadastrada.",
  RESPONSAVEL_SEM_ACESSO: "Custo indisponível para o responsável atual.",
};

/** Linha "Custo estimado" — só renderiza para quem tem custos_ver no cliente (barreira real é o backend). */
function CostLine({ taskId, enabled }: { taskId: string; enabled: boolean }) {
  const cost = useTaskCost(taskId, enabled);
  if (!enabled) return null;
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Custo estimado</span>
      {cost.isLoading ? (
        <span className="h-3.5 w-24 animate-pulse rounded bg-muted" />
      ) : cost.isError || !cost.data ? (
        <span className="text-[13px] text-muted-foreground">Não foi possível calcular agora.</span>
      ) : cost.data.state === "OK" ? (
        <div>
          <span className="text-[15px] font-medium tabular-nums">{formatBRL(cost.data.cents ?? 0)}</span>
          <span className="ml-2 text-[12px] text-muted-foreground">a preço de hoje</span>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Calculado pelo responsável principal e pelas horas estimadas. Salário mensal entra proporcional às horas.
          </p>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] text-muted-foreground">—</span>
          <span className="text-[13px] text-muted-foreground">{COST_MSG[cost.data.state]}</span>
        </div>
      )}
    </div>
  );
}

const PRIOS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
];
const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "A fazer" },
  { value: "DOING", label: "Fazendo" },
  { value: "DONE", label: "Feito" },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-border bg-card p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors disabled:opacity-60",
            value === o.value ? "bg-accent text-foreground" : "text-muted-foreground enabled:hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface Form {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string;
  estimated: string;
}

export function TaskDetailDialog({
  taskId,
  members,
  onOpenChange,
}: {
  taskId: string | null;
  members: Member[];
  onOpenChange: (o: boolean) => void;
}) {
  const detail = useTaskDetail(taskId);
  const task = detail.data;
  const projectId = task?.projectId ?? "";

  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);
  const add = useAddSubtask(taskId ?? "");
  const toggle = useToggleSubtask(taskId ?? "");
  const removeSub = useDeleteSubtask(taskId ?? "");

  const canEdit = useCan(PERMISSIONS.tarefas_editar);
  const canDelete = useCan(PERMISSIONS.tarefas_excluir);
  // custos_ver é POR cliente: lê do detalhe do cliente da tarefa (mesma chave do board = sem fetch extra).
  const projectDetail = useProject(projectId || null);
  const canSeeCost = projectDetail.data?.canSeeCost === true;

  const [form, setForm] = useState<Form | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [tab, setTab] = useState<"detalhes" | "atividade">("detalhes");
  const [confirmClose, setConfirmClose] = useState(false);
  const seededFor = useRef<string | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);

  // auto-resize da descrição (cresce com o conteúdo, sem barra interna)
  useEffect(() => {
    const el = descRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [form?.description, taskId]);

  useEffect(() => {
    if (taskId === null) {
      seededFor.current = null;
      setForm(null);
      setConfirmClose(false);
      return;
    }
    if (task && seededFor.current !== task.id) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        due: task.dueDate ? task.dueDate.slice(0, 10) : "",
        estimated: minutesToHoursInput(task.estimatedMinutes),
      });
      setTab("detalhes");
      seededFor.current = task.id;
    }
  }, [task, taskId]);

  const subs = task?.subtasks ?? [];
  const doneCount = subs.filter((s) => s.done).length;

  const dueBaseline = task?.dueDate ? task.dueDate.slice(0, 10) : "";
  const estimatedBaseline = minutesToHoursInput(task?.estimatedMinutes);
  const descriptionBaseline = task?.description ?? "";
  const dirty =
    !!form &&
    !!task &&
    (form.title.trim() !== task.title ||
      form.description !== descriptionBaseline ||
      form.status !== task.status ||
      form.priority !== task.priority ||
      form.due !== dueBaseline ||
      form.estimated !== estimatedBaseline);

  async function save() {
    if (!form || !task || !form.title.trim()) return;
    const patch: UpdateTaskInput = {
      title: form.title.trim(),
      description: form.description.trim() === "" ? null : form.description.trim(),
      status: form.status,
      priority: form.priority,
      dueDate: form.due ? new Date(`${form.due}T12:00:00`).toISOString() : null,
      // estimatedMinutes é insumo de custo: só vai no payload de quem tem custos.ver (senão nem seta nem apaga). [SEC-custo]
      ...(canSeeCost ? { estimatedMinutes: parseHoursToMinutes(form.estimated) } : {}),
    };
    await update.mutateAsync({ id: task.id, patch, updatedAt: task.updatedAt });
    seededFor.current = null; // re-semeia com o dado fresco após invalidar
  }

  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle("");
    await add.mutateAsync(t);
  }

  async function onDelete() {
    if (!task) return;
    await del.mutateAsync({ id: task.id, engagementId: task.engagementId });
    onOpenChange(false);
  }

  function requestClose(o: boolean) {
    if (o) return onOpenChange(true);
    // guarda só quando há edição pendente E não está salvando (durante o save, deixa fechar). [EC-03, review #1]
    if (dirty && !update.isPending) return setConfirmClose(true);
    onOpenChange(false);
  }

  return (
    <>
    <Dialog open={taskId !== null} onOpenChange={requestClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {detail.isError ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Tarefa não encontrada ou sem acesso.</div>
        ) : detail.isLoading || !task || !form ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Detalhe da tarefa</DialogTitle>
            </DialogHeader>

            <div className="-mx-1 mb-1 flex gap-4 border-b border-border">
              {(["detalhes", "atividade"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-current={tab === t ? "page" : undefined}
                  className={cn(
                    "px-1 pb-2 pt-1 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tab === t
                      ? "border-b-2 border-primary font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "detalhes" ? "Detalhes" : "Atividade"}
                </button>
              ))}
            </div>

            {tab === "atividade" ? (
              <ActivityTab taskId={task.id} membersById={membersById} enabled={tab === "atividade"} />
            ) : (
            <>
            <div className="flex items-start gap-2">
              <Input
                value={form.title}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
                className="h-auto border-0 bg-transparent px-0 text-[15px] font-medium tracking-tight focus-visible:ring-0"
              />
              {canDelete && (
                <button
                  type="button"
                  aria-label="Excluir tarefa"
                  onClick={onDelete}
                  disabled={del.isPending}
                  className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-amber disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Status</span>
                <Segmented
                  value={form.status}
                  options={STATUSES}
                  disabled={!canEdit}
                  onChange={(v) => setForm({ ...form, status: v })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Prioridade</span>
                <Segmented
                  value={form.priority}
                  options={PRIOS}
                  disabled={!canEdit}
                  onChange={(v) => setForm({ ...form, priority: v })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Prazo</span>
                  {(() => {
                    // Pill de prazo urgente (só vencida/hoje) — reflete o prazo salvo da tarefa. [cor contida]
                    const dt = dueTag(task.dueDate, task.status);
                    return isDueUrgent(dt.state) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber/30 bg-amber/10 px-2 py-0.5 text-[11.5px] text-amber">
                        <CalendarClock className="size-3.5" aria-hidden />
                        {dt.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                <Input
                  type="date"
                  value={form.due}
                  disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, due: e.target.value })}
                  className="h-9"
                />
              </div>
              {/* Horas estimadas = insumo do custo → só quem tem custos.ver vê/edita. [SEC-custo] */}
              {canSeeCost && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Horas estimadas</span>
                  <Input
                    inputMode="decimal"
                    placeholder="ex.: 8 ou 1,5"
                    value={form.estimated}
                    disabled={!canEdit}
                    onChange={(e) => setForm({ ...form, estimated: e.target.value })}
                    className="h-9"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Responsáveis</span>
                <AssigneesEditor
                  taskId={task.id}
                  projectId={projectId}
                  engagementId={task.engagementId}
                  assigneeId={task.assigneeId}
                  extraAssigneeIds={task.extraAssigneeIds ?? []}
                  members={members}
                  disabled={!canEdit}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Descrição</span>
                <Textarea
                  ref={descRef}
                  value={form.description}
                  disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={5000}
                  placeholder={canEdit ? "Adicione detalhes da tarefa" : undefined}
                  className="min-h-[84px] resize-none overflow-hidden"
                />
              </div>

              <CostLine taskId={task.id} enabled={canSeeCost} />
            </div>

            {canEdit && dirty && (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setForm({
                      title: task.title,
                      description: descriptionBaseline,
                      status: task.status,
                      priority: task.priority,
                      due: dueBaseline,
                      estimated: estimatedBaseline,
                    })
                  }
                >
                  Descartar
                </Button>
                <Button type="button" onClick={save} disabled={!form.title.trim() || update.isPending}>
                  {update.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            )}

            <div className="mt-1 border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="font-medium">Subtarefas</span>
                {subs.length > 0 && (
                  <span className="text-muted-foreground">
                    {doneCount}/{subs.length}
                  </span>
                )}
              </div>

              <ul className="flex flex-col gap-1">
                {subs.map((s) => (
                  <li key={s.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1">
                    <button
                      type="button"
                      aria-label={s.done ? "Desmarcar" : "Marcar como feita"}
                      onClick={() => toggle.mutate({ id: s.id, done: !s.done })}
                      className={cn(
                        "flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                        s.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/50 text-transparent hover:border-foreground",
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </button>
                    <span className={cn("flex-1 text-[13px]", s.done && "text-muted-foreground line-through")}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      aria-label="Remover subtarefa"
                      onClick={() => removeSub.mutate(s.id)}
                      className="text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-amber"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
                {subs.length === 0 && (
                  <li className="px-1 py-1 text-[12.5px] text-muted-foreground">Nenhuma subtarefa ainda.</li>
                )}
              </ul>

              <form onSubmit={addSub} className="mt-2 flex items-center gap-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Adicionar subtarefa"
                  maxLength={200}
                  className="h-9"
                />
                <button
                  type="submit"
                  aria-label="Adicionar"
                  disabled={!newTitle.trim() || add.isPending}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <Plus className="size-4" />
                </button>
              </form>
            </div>
            </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={confirmClose} onOpenChange={(o) => !o && setConfirmClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar alterações?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Você tem alterações não salvas nesta tarefa. Descartar?
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmClose(false)}>
            Continuar editando
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setConfirmClose(false);
              onOpenChange(false);
            }}
          >
            Descartar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
