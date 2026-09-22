"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  Check,
  Plus,
  Copy,
  Trash2,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PERMISSIONS, type TaskPriority, type TaskStatus, type UpdateTaskInput } from "@sistema-tasks/contracts";
import type { CostState, Task } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { dueTag, isDueUrgent } from "@/lib/due";
import { AssigneesEditor } from "@/components/board/assignees-editor";
import { AttachmentsSection } from "@/components/board/attachments-section";
import { ActivityTab } from "@/components/board/activity-tab";
import {
  useTaskDetail,
  useUpdateTask,
  useMoveTask,
  useDeleteTask,
  useRestoreTask,
  useCreateTask,
  useAddSubtask,
  useToggleSubtask,
  useDeleteSubtask,
  errorCode,
} from "@/lib/hooks/use-tasks";
import { undoToast } from "@/lib/undo-toast";
import { copyName } from "@/lib/copy-name";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { useEngagementTasks, useCreateEngagementTask } from "@/lib/hooks/use-engagement-board";
import { positionForIndex } from "@/lib/position";
import { useCan } from "@/lib/hooks/use-can";
import { useProject } from "@/lib/hooks/use-projects";
import { useProjectMembers } from "@/lib/hooks/use-members";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useTaskCost } from "@/lib/hooks/use-cost";
import { httpStatus } from "@/lib/http-error";
import { parseHoursToMinutes, minutesToHoursInput } from "@/lib/duration";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

const COST_MSG: Record<Exclude<CostState, "OK">, string> = {
  SEM_HORAS: "Defina as horas estimadas para calcular.",
  SEM_RESPONSAVEL: "Defina um responsável para calcular.",
  SEM_REMUNERACAO: "O responsável não tem remuneração cadastrada.",
  RESPONSAVEL_SEM_ACESSO: "Custo indisponível para o responsável atual.",
};

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

interface Form {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string;
  estimated: string;
}

function baselineFrom(task: Task): Form {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    due: task.dueDate ? task.dueDate.slice(0, 10) : "",
    estimated: minutesToHoursInput(task.estimatedMinutes),
  };
}

function isForm(v: unknown): v is Form {
  return !!v && typeof v === "object" && typeof (v as Form).title === "string";
}

/** Só aceita caminho interno absoluto — evita open redirect via `?from` forjado. [rev-fase4 sec] */
function safeInternalPath(p: string | null): string | null {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\")) return null;
  return p;
}

export function TaskDetailView({ taskId }: { taskId: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const fromParam = safeInternalPath(sp.get("from"));

  const detail = useTaskDetail(taskId);
  const task = detail.data;
  const projectId = task?.projectId ?? "";

  const project = useProject(projectId || null);
  const canSeeCost = project.data?.canSeeCost === true;
  const membersQuery = useProjectMembers(projectId || null);
  const members = membersQuery.data ?? [];
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const engagements = useEngagements(projectId || null);
  const clientName = project.data?.name;
  const engagementName = engagements.data?.find((e) => e.id === task?.engagementId)?.name;

  const canEdit = useCan(PERMISSIONS.tarefas_editar);
  const canDelete = useCan(PERMISSIONS.tarefas_excluir);
  const canDuplicate = useCan(PERMISSIONS.tarefas_criar);

  const update = useUpdateTask(projectId);
  const move = useMoveTask(projectId, task?.engagementId);
  const del = useDeleteTask(projectId);
  const restoreTask = useRestoreTask(projectId);
  // Duplicar roteia pelo parent: engagement real → /engagements/:id/tasks; senão cairia no Projeto geral.
  const createProjectTask = useCreateTask(projectId);
  const createEngTask = useCreateEngagementTask(task?.engagementId ?? "");
  const [duplicating, setDuplicating] = useState(false);
  const add = useAddSubtask(taskId);
  const toggle = useToggleSubtask(taskId);
  const removeSub = useDeleteSubtask(taskId);

  // Irmãos da coluna (mesmo engagement + status), pro controle "Posição na coluna". Ordena IGUAL ao
  // board (position, desempate por id — `position:0` é falsy, então nada de `position || id`). [painel]
  const engagementTasks = useEngagementTasks(task?.engagementId ?? null);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const [moveAnnounce, setMoveAnnounce] = useState("");
  const column = useMemo(() => {
    if (!task) return null;
    const list = (engagementTasks.data ?? [])
      .filter((t) => t.status === task.status)
      .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
    const index = list.findIndex((t) => t.id === task.id);
    const others = list.filter((t) => t.id !== task.id).map((t) => t.position);
    return { others, index, total: list.length };
  }, [engagementTasks.data, task]);

  const [form, setForm] = useState<Form | null>(null);
  // Token de concorrência FIXO no seed — se usasse o updatedAt "ao vivo", o refetch-no-foco o avançaria
  // e o if-unmodified-since deixaria de proteger contra sobrescrever edição alheia. [rev-painel]
  const [seededUpdatedAt, setSeededUpdatedAt] = useState<string | undefined>();
  const [newTitle, setNewTitle] = useState("");
  const [tab, setTab] = useState<"detalhes" | "atividade">("detalhes");
  const [isLg, setIsLg] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const seededFor = useRef<string | null>(null);
  const freshTokenFor = useRef<string | null>(null); // token já corrigido do fetch fresco desta carga
  const descRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const draftKey = `sdt_taskdraft_${taskId}`;
  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* sem persistência, tudo bem */
    }
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsLg(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // auto-resize da descrição
  useEffect(() => {
    const el = descRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [form?.description]);

  // auto-resize do título — quebra em várias linhas em vez de clipar títulos longos. [fix impeccable]
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [form?.title]);

  // Seed do form: restaura rascunho do localStorage (rede de segurança contra saída sem guarda),
  // senão parte do dado salvo. Fixa o token de concorrência do momento do carregamento. [rev-painel]
  useEffect(() => {
    if (task && seededFor.current !== task.id) {
      let draft: Form | null = null;
      try {
        const raw = localStorage.getItem(`sdt_taskdraft_${task.id}`);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (isForm(parsed)) draft = parsed;
      } catch {
        draft = null;
      }
      setForm(draft ?? baselineFrom(task));
      setSeededUpdatedAt(task.updatedAt); // provisório (pode vir de cache); corrigido pelo efeito abaixo
      setTab("detalhes");
      seededFor.current = task.id;
      freshTokenFor.current = null; // libera o re-semear do fetch fresco deste mount
    }
  }, [task]);

  // Corrige o token de concorrência com o updatedAt FRESCO (o fetch DESTE mount), não o do cache velho —
  // senão o if-unmodified-since sai defasado e todo save dá 409 falso. Uma vez por carga: refetch-no-foco
  // NÃO re-semeia (o guard freshTokenFor preserva a proteção contra sobrescrever edição alheia). [bug 409]
  useEffect(() => {
    if (task && detail.isFetchedAfterMount && freshTokenFor.current !== task.id) {
      setSeededUpdatedAt(task.updatedAt);
      freshTokenFor.current = task.id;
    }
  }, [task, detail.isFetchedAfterMount]);

  const subs = task?.subtasks ?? [];
  const doneCount = subs.filter((s) => s.done).length;

  const baseline = task ? baselineFrom(task) : null;
  const dirty =
    !!form &&
    !!baseline &&
    (form.title.trim() !== baseline.title ||
      form.description !== baseline.description ||
      form.status !== baseline.status ||
      form.priority !== baseline.priority ||
      form.due !== baseline.due ||
      form.estimated !== baseline.estimated);

  // Persiste/limpa o rascunho conforme o dirty (mesmo padrão do rascunho de comentário).
  useEffect(() => {
    if (!form) return;
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify(form));
      else localStorage.removeItem(draftKey);
    } catch {
      /* sem persistência */
    }
  }, [form, dirty, draftKey]);

  // Aviso nativo ao dar F5 / fechar aba / navegar pra fora com edição não salva.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const backPath = fromParam || (task ? `/clientes/${task.projectId}/projetos/${task.engagementId}` : "/tarefas");

  function goBack() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    router.push(backPath);
  }

  async function save() {
    if (!form || !task || !form.title.trim()) return;
    const patch: UpdateTaskInput = {
      title: form.title.trim(),
      description: form.description.trim() === "" ? null : form.description.trim(),
      status: form.status,
      priority: form.priority,
      dueDate: form.due ? new Date(`${form.due}T12:00:00`).toISOString() : null,
      // horas = insumo de custo: só entra no payload de quem tem custos.ver. [SEC-custo]
      ...(canSeeCost ? { estimatedMinutes: parseHoursToMinutes(form.estimated) } : {}),
    };
    try {
      const updated = await update.mutateAsync({ id: task.id, patch, updatedAt: seededUpdatedAt });
      if (updated?.updatedAt) setSeededUpdatedAt(updated.updatedAt); // avança o token pro próximo save
      clearDraft();
      // NÃO anula seededFor: o baseline recomputa do cache fresco e o dirty zera sozinho — re-semear
      // aqui descartaria uma edição feita logo após o save (e o token velho geraria CONFLITO falso). [rev-fase4]
    } catch (e) {
      if (errorCode(e) === "CONFLITO") setConflict(true);
      // demais erros já viram toast no hook
    }
  }

  function discard() {
    if (!baseline) return;
    setForm(baseline);
    clearDraft();
  }

  // Mover a tarefa 1 posição na coluna (mesmo status). Imediato/otimista, fora do Salvar.
  // Só quando o form está limpo (senão o /move avançaria o updatedAt e um Save posterior mascararia
  // conflito de terceiros) — por isso as setas ficam disabled com `dirty`. [painel concorrência]
  async function moveInColumn(dir: -1 | 1) {
    if (!task || !column || column.index < 0 || move.isPending) return;
    const slot = column.index + dir; // ↑ = index-1 · ↓ = index+1 (na lista sem o próprio)
    if (slot < 0 || slot > column.others.length) return;
    const position = positionForIndex(column.others, slot);
    const nextIndex = column.index + dir;
    try {
      await move.mutateAsync({ id: task.id, status: task.status, position });
      // Re-semeia do dado fresco: traz updatedAt/título atuais (pega edição de terceiro) e mantém o
      // token do Save honesto — bumpar só o updatedAt local mascararia conflito. Como as setas só ficam
      // ativas com o form limpo, re-semear não descarta edição do usuário. [lente concorrência]
      seededFor.current = null;
      detail.refetch();
      setMoveAnnounce(`Posição ${nextIndex + 1} de ${column.total}`);
      // Se a seta usada vai desabilitar no limite, joga o foco pra oposta (não perde o foco).
      if (dir === -1 && nextIndex <= 0) downRef.current?.focus();
      else if (dir === 1 && nextIndex >= column.total - 1) upRef.current?.focus();
    } catch {
      /* erros já viram toast no hook */
    }
  }

  function reloadFromServer() {
    setConflict(false);
    clearDraft();
    seededFor.current = null; // força re-seed com o dado fresco
    detail.refetch();
  }

  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle("");
    await add.mutateAsync(t);
  }

  // Excluir tarefa: direto (sem modal), com "Desfazer" no toast. [excluir-com-seguranca]
  async function onDelete() {
    if (!task) return;
    const { id, engagementId } = task;
    const nSub = task.subtasks?.length ?? 0;
    try {
      await del.mutateAsync({ id, engagementId });
      clearDraft();
      router.push(backPath);
      const msg = nSub > 0 ? `Tarefa e ${nSub} ${nSub === 1 ? "subtarefa" : "subtarefas"} excluídas` : "Tarefa excluída";
      undoToast(msg, () => restoreTask.mutate({ id, engagementId }));
    } catch {
      /* erro já vira toast no hook; permanece na tela */
    }
  }

  // Duplicar tarefa: cópia RASA (só os campos do create) roteando pelo parent. Não traz subtarefas/anexos. [crud-kebab]
  async function onDuplicate() {
    if (!task || duplicating) return;
    setDuplicating(true);
    const payload = {
      quiet: true, // sem o toast genérico "Tarefa criada" do hook — mostro o meu, com o escopo
      title: copyName(task.title),
      description: task.description ?? undefined,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? undefined,
      assigneeId: task.assigneeId ?? undefined,
      // horas estimadas só entram pra quem tem custos.ver (espelha o save()). [SEC-custo]
      ...(canSeeCost ? { estimatedMinutes: task.estimatedMinutes ?? undefined } : {}),
    };
    try {
      const created = task.engagementId
        ? await createEngTask.mutateAsync(payload)
        : await createProjectTask.mutateAsync(payload);
      toast.success("Cópia criada — sem subtarefas nem anexos", {
        action: { label: "Abrir", onClick: () => router.push(`/tarefas/${created.id}?from=${encodeURIComponent(backPath)}`) },
      });
    } catch {
      /* o toast de erro já vem do hook de create */
    } finally {
      setDuplicating(false);
    }
  }

  // ---- estados de topo ----
  const status = httpStatus(detail.error);
  if (detail.isError && (status === 404 || status === 403)) {
    return (
      <FullState
        title="Tarefa não encontrada"
        desc="Ela não existe ou você não tem acesso a ela."
        action={<Button variant="secondary" onClick={() => router.push(fromParam || "/tarefas")}>Voltar</Button>}
      />
    );
  }
  if (detail.isError) {
    return (
      <FullState
        title="Não foi possível carregar a tarefa"
        desc="Tente de novo em instantes."
        action={<Button variant="secondary" onClick={() => detail.refetch()}>Tentar de novo</Button>}
      />
    );
  }
  if (detail.isLoading || !task || !form) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const detailsPane = (
    <div className={cn("flex flex-col gap-4", tab === "detalhes" ? "" : "hidden", "lg:flex")}>
      <div className="sr-only">
        <h1>{form.title || "Detalhe da tarefa"}</h1>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {moveAnnounce}
      </span>
      <Textarea
        ref={titleRef}
        value={form.title}
        aria-label="Título da tarefa"
        disabled={!canEdit}
        rows={1}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault(); // título é uma linha lógica; não insere quebra
        }}
        maxLength={200}
        className="min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-xl font-medium leading-tight tracking-tight shadow-none focus-visible:ring-0"
      />

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Field label="Status">
          <Segmented label="Status" value={form.status} options={STATUSES} disabled={!canEdit} onChange={(v) => setForm({ ...form, status: v })} />
        </Field>
        {canEdit && column && column.total >= 2 && (
          <Field label="Posição na coluna">
            <div className="flex items-center gap-2.5">
              <div role="group" aria-label="Posição na coluna" className="inline-flex w-fit gap-0.5 rounded-lg border border-border bg-card p-[3px]">
                <button
                  ref={upRef}
                  type="button"
                  aria-label="Mover uma posição para cima na coluna"
                  disabled={dirty || engagementTasks.isLoading || column.index <= 0}
                  onClick={() => moveInColumn(-1)}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors enabled:hover:text-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  ref={downRef}
                  type="button"
                  aria-label="Mover uma posição para baixo na coluna"
                  disabled={dirty || engagementTasks.isLoading || column.index < 0 || column.index >= column.total - 1}
                  onClick={() => moveInColumn(1)}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors enabled:hover:text-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <span className="text-[12.5px] text-muted-foreground">
                {column.index >= 0 ? `${column.index + 1} de ${column.total}` : `— de ${column.total}`}
              </span>
              {dirty && <span className="text-[12px] text-muted-foreground">Salve para reordenar</span>}
            </div>
          </Field>
        )}
        <Field label="Prioridade">
          <Segmented label="Prioridade" value={form.priority} options={PRIOS} disabled={!canEdit} onChange={(v) => setForm({ ...form, priority: v })} />
        </Field>
        <Field
          label="Prazo"
          extra={(() => {
            const dt = dueTag(task.dueDate, task.status);
            return isDueUrgent(dt.state) ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber/30 bg-amber/10 px-2 py-0.5 text-[11.5px] text-amber">
                <CalendarClock className="size-3.5" aria-hidden />
                {dt.label}
              </span>
            ) : null;
          })()}
        >
          <Input type="date" aria-label="Prazo" value={form.due} disabled={!canEdit} onChange={(e) => setForm({ ...form, due: e.target.value })} className="h-9" />
        </Field>
        {canSeeCost && (
          <Field label="Horas estimadas">
            <Input
              inputMode="decimal"
              aria-label="Horas estimadas"
              placeholder="ex.: 8 ou 1,5"
              value={form.estimated}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, estimated: e.target.value })}
              className="h-9"
            />
          </Field>
        )}
      </div>

      <Field label="Responsáveis">
        <AssigneesEditor
          taskId={task.id}
          projectId={projectId}
          engagementId={task.engagementId}
          assigneeId={task.assigneeId}
          extraAssigneeIds={task.extraAssigneeIds ?? []}
          members={members}
          disabled={!canEdit}
        />
      </Field>

      <Field label="Descrição">
        <Textarea
          ref={descRef}
          aria-label="Descrição"
          value={form.description}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={5000}
          placeholder={canEdit ? "Adicione detalhes da tarefa" : undefined}
          className="min-h-[84px] resize-none overflow-hidden"
        />
      </Field>

      {/* Subtarefas */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between text-[13px]">
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
                  s.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 text-transparent hover:border-foreground",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </button>
              <span className={cn("flex-1 text-[13px]", s.done && "text-muted-foreground line-through")}>{s.title}</span>
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
          {subs.length === 0 && <li className="px-1 py-1 text-[12.5px] text-muted-foreground">Nenhuma subtarefa ainda.</li>}
        </ul>
        <form onSubmit={addSub} className="mt-1 flex items-center gap-2">
          <Input value={newTitle} aria-label="Nova subtarefa" onChange={(e) => setNewTitle(e.target.value)} placeholder="Adicionar subtarefa" maxLength={200} className="h-9" />
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

      <AttachmentsSection taskId={task.id} disabled={!canEdit} />

      <CostLine taskId={task.id} enabled={canSeeCost} />

      {canEdit && dirty && (
        <div className="sticky bottom-0 z-10 -mx-1 mt-1 flex justify-end gap-2 border-t border-border bg-background px-1 py-3">
          <Button type="button" variant="secondary" onClick={discard}>
            Descartar
          </Button>
          <Button type="button" onClick={save} disabled={!form.title.trim() || update.isPending}>
            {update.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      )}
    </div>
  );

  const activityPane = (
    <div className={cn(tab === "atividade" ? "" : "hidden", "lg:block")}>
      <span className="mb-3 hidden text-[11px] uppercase tracking-wide text-muted-foreground/80 lg:block">Atividade</span>
      <ActivityTab taskId={task.id} membersById={membersById} enabled={isLg || tab === "atividade"} />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-3.5">
        <button
          type="button"
          aria-label="Voltar"
          onClick={goBack}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
        </button>
        <nav aria-label="Trilha" className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
          {clientName ? <span className="truncate">{clientName}</span> : <span className="h-3 w-16 animate-pulse rounded bg-muted" />}
          <span className="text-muted-foreground/50">›</span>
          {engagementName ? <span className="truncate">{engagementName}</span> : <span className="h-3 w-16 animate-pulse rounded bg-muted" />}
        </nav>
        <ActionsMenu
          label={`Ações da tarefa: ${task.title}`}
          className="ml-auto"
          items={[
            ...(canDuplicate
              ? [{ key: "dup", label: "Duplicar", icon: Copy, onSelect: onDuplicate }]
              : []),
            ...(canDelete
              ? [{ key: "del", label: "Excluir", icon: Trash2, danger: true, onSelect: onDelete }]
              : []),
          ]}
        />
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {conflict && (
            <div className="sticky top-0 z-20 mb-4 flex items-center gap-3 rounded-lg border border-amber/40 bg-card px-3.5 py-2.5">
              <AlertTriangle className="size-4 shrink-0 text-amber" aria-hidden />
              <span className="flex-1 text-[12.5px] text-muted-foreground">
                Esta tarefa foi alterada por outra pessoa. Recarregue para ver a versão atual (suas edições não salvas serão descartadas).
              </span>
              <Button type="button" variant="secondary" onClick={reloadFromServer} className="shrink-0">
                <RefreshCw className="size-3.5" />
                Recarregar
              </Button>
            </div>
          )}

          {/* Abas só no mobile */}
          <div className="mb-4 flex gap-4 border-b border-border lg:hidden">
            {(["detalhes", "atividade"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={tab === t ? "page" : undefined}
                className={cn(
                  "px-1 pb-2 pt-1 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "detalhes" ? "Detalhes" : "Atividade"}
              </button>
            ))}
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
            {detailsPane}
            {activityPane}
          </div>
        </div>
      </div>

      {/* Confirmar descarte ao sair */}
      <Dialog open={confirmLeave} onOpenChange={(o) => !o && setConfirmLeave(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar alterações?</DialogTitle>
            <DialogDescription>Você tem alterações não salvas nesta tarefa.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmLeave(false)}>
              Continuar editando
            </Button>
            <Button
              type="button"
              className="bg-amber text-primary-foreground hover:bg-amber/90"
              onClick={() => {
                setConfirmLeave(false);
                clearDraft();
                router.push(backPath);
              }}
            >
              Descartar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, extra, children }: { label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{label}</span>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit gap-0.5 rounded-lg border border-border bg-card p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] transition-colors disabled:opacity-60",
            value === o.value ? "bg-accent text-foreground" : "text-muted-foreground enabled:hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CostLine({ taskId, enabled }: { taskId: string; enabled: boolean }) {
  const cost = useTaskCost(taskId, enabled);
  if (!enabled) return null;
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Custo estimado</span>
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

function FullState({ title, desc, action }: { title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <h1 className="text-base font-medium tracking-tight">{title}</h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{desc}</p>
      </div>
      {action}
    </div>
  );
}
