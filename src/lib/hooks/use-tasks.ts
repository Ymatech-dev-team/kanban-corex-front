import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import type { CreateTaskInput, UpdateTaskInput, TaskStatus } from "@sistema-tasks/contracts";
import { api } from "@/lib/api";
import { projectCostKey, taskCostKey } from "@/lib/hooks/use-cost";
import { engTasksKey, engCostKey } from "@/lib/hooks/use-engagement-board";
import { engagementsKey } from "@/lib/hooks/use-engagements";
import { activityKey } from "@/lib/hooks/use-task-activity";
import type { Task } from "@/lib/types";

type ApiError = AxiosError<{ error?: { code?: string; message?: string } }>;
export function errorCode(e: unknown): string | undefined {
  return (e as ApiError)?.response?.data?.error?.code;
}
function idemKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function tasksKey(projectId: string | null) {
  return ["tasks", projectId] as const;
}

export function useTasks(projectId: string | null) {
  return useQuery<Task[]>({
    queryKey: tasksKey(projectId),
    enabled: !!projectId,
    queryFn: async () => (await api.get<{ tasks: Task[] }>(`/projects/${projectId}/tasks`)).data.tasks,
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    // `quiet` (quick-add em série) suprime o toast de sucesso — não vai no payload da API.
    mutationFn: async ({ quiet: _quiet, ...input }: CreateTaskInput & { quiet?: boolean }) =>
      (
        await api.post<Task>(`/projects/${projectId}/tasks`, input, {
          headers: { "idempotency-key": idemKey() },
        })
      ).data,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: tasksKey(projectId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // visão global reflete a mudança [tarefas-visao-global RF-E5]
      qc.invalidateQueries({ queryKey: projectCostKey(projectId) }); // custo agregado muda
      qc.invalidateQueries({ queryKey: engagementsKey(projectId) }); // taskCount dos cards de projeto
      if (data?.engagementId) {
        qc.invalidateQueries({ queryKey: engTasksKey(data.engagementId) });
        qc.invalidateQueries({ queryKey: engCostKey(data.engagementId) });
      }
      if (!vars.quiet) toast.success("Tarefa criada");
    },
    onError: () => toast.error("Não foi possível criar a tarefa"),
  });
}

interface MoveVars {
  id: string;
  status: TaskStatus;
  position: number;
}

/**
 * Mover no Kanban com atualização otimista. O backend discrimina os erros:
 * TAREFA_REMOVIDA (some), PROJETO_SEM_ACESSO (ejeta o cliente), SEM_PERMISSAO. [JOR-1c]
 */
export function useMoveTask(projectId: string, engagementId?: string) {
  const qc = useQueryClient();
  // Chave da lista que o board REALMENTE renderiza: por projeto (engagement) ou por cliente. [review B2]
  const key = engagementId ? engTasksKey(engagementId) : tasksKey(projectId);
  return useMutation({
    mutationFn: async ({ id, status, position }: MoveVars) =>
      (await api.patch<Task>(`/tasks/${id}/move`, { status, position })).data,
    onMutate: async ({ id, status, position }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, status, position } : t)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      const code = errorCode(err);
      if (code === "TAREFA_REMOVIDA") {
        toast.error("Essa tarefa foi removida");
        qc.invalidateQueries({ queryKey: key });
      } else if (code === "PROJETO_SEM_ACESSO") {
        toast.error("Seu acesso a este cliente foi removido");
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["me"] });
      } else if (code === "SEM_PERMISSAO") {
        toast.error("Você não tem permissão para mover tarefas");
      } else {
        toast.error("Não foi possível mover a tarefa");
      }
    },
    onSettled: (data, _e, vars) => {
      qc.invalidateQueries({ queryKey: key }); // lista renderizada
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // visão global [tarefas-visao-global RF-E5]
      if (engagementId) qc.invalidateQueries({ queryKey: tasksKey(projectId) }); // roll-up/metrics do cliente
      qc.invalidateQueries({ queryKey: activityKey(vars.id) }); // move gera STATUS_CHANGED na timeline
      // mudar status (ex.: p/ DONE) troca realizado↔planejado do custo
      qc.invalidateQueries({ queryKey: taskCostKey(vars.id) });
      qc.invalidateQueries({ queryKey: projectCostKey(projectId) });
      const engId = engagementId ?? data?.engagementId;
      if (engId) {
        qc.invalidateQueries({ queryKey: engTasksKey(engId) });
        qc.invalidateQueries({ queryKey: engCostKey(engId) });
      }
    },
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, updatedAt }: { id: string; patch: UpdateTaskInput; updatedAt?: string }) =>
      (
        await api.patch<Task>(`/tasks/${id}`, patch, {
          // header customizado (não `If-Unmodified-Since`, que o edge da Vercel barra com 412). [fix 412]
          headers: updatedAt ? { "x-expected-updated-at": updatedAt } : undefined,
        })
      ).data,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: tasksKey(projectId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // visão global reflete a mudança [tarefas-visao-global RF-E5]
      qc.invalidateQueries({ queryKey: taskKey(vars.id) });
      qc.invalidateQueries({ queryKey: activityKey(vars.id) }); // timeline reflete a edição
      // custo deriva de horas/responsável/status: sem isso o painel de custo fica stale [review jornada]
      qc.invalidateQueries({ queryKey: taskCostKey(vars.id) });
      qc.invalidateQueries({ queryKey: projectCostKey(projectId) });
      if (data?.engagementId) {
        qc.invalidateQueries({ queryKey: engTasksKey(data.engagementId) });
        qc.invalidateQueries({ queryKey: engCostKey(data.engagementId) });
      }
      toast.success("Tarefa atualizada");
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "CONFLITO") toast.error("A tarefa foi alterada por outra pessoa. Recarregue.");
      else if (code === "PROJETO_SEM_ACESSO") toast.error("Seu acesso a este cliente foi removido");
      else if (code === "SEM_PERMISSAO") toast.error("Você não tem permissão para editar");
      else toast.error("Não foi possível salvar a tarefa");
    },
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; engagementId?: string }) => (await api.delete(`/tasks/${id}`)).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: tasksKey(projectId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // visão global reflete a mudança [tarefas-visao-global RF-E5]
      qc.invalidateQueries({ queryKey: projectCostKey(projectId) }); // custo agregado muda
      qc.invalidateQueries({ queryKey: engagementsKey(projectId) }); // taskCount dos cards de projeto
      if (vars.engagementId) {
        qc.invalidateQueries({ queryKey: engTasksKey(vars.engagementId) });
        qc.invalidateQueries({ queryKey: engCostKey(vars.engagementId) });
      }
      // o toast de sucesso vira o toast de "Desfazer", disparado pela tela.
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "SEM_PERMISSAO") toast.error("Você não tem permissão para excluir");
      else toast.error("Não foi possível excluir a tarefa");
    },
  });
}

/** Desfaz a exclusão da tarefa (restaura o lote). Idempotente no backend. [excluir-com-seguranca] */
export function useRestoreTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    // `count` (do undo de lote) só ajusta a mensagem — restaura o lote inteiro de qualquer jeito.
    mutationFn: async ({ id }: { id: string; engagementId?: string; count?: number }) =>
      (await api.post(`/tasks/${id}/restore`)).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: tasksKey(projectId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] });
      qc.invalidateQueries({ queryKey: projectCostKey(projectId) });
      qc.invalidateQueries({ queryKey: engagementsKey(projectId) });
      qc.invalidateQueries({ queryKey: taskKey(vars.id) });
      if (vars.engagementId) {
        qc.invalidateQueries({ queryKey: engTasksKey(vars.engagementId) });
        qc.invalidateQueries({ queryKey: engCostKey(vars.engagementId) });
      }
      const n = vars.count ?? 1;
      toast.success(n > 1 ? `${n} tarefas restauradas` : "Tarefa restaurada");
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "VALIDACAO") toast.error("Não foi possível desfazer: o projeto ou o cliente foi excluído");
      else toast.error("Não foi possível restaurar a tarefa");
    },
  });
}

// ---- Ações em massa [acoes-em-massa] ----

/** Invalida as mesmas chaves do delete/move unitário (lista do cliente + do projeto + custo + contagens). */
function invalidateBoard(qc: ReturnType<typeof useQueryClient>, projectId: string, engagementId?: string) {
  qc.invalidateQueries({ queryKey: tasksKey(projectId) });
  qc.invalidateQueries({ queryKey: ["tasks", "all"] });
  qc.invalidateQueries({ queryKey: projectCostKey(projectId) });
  qc.invalidateQueries({ queryKey: engagementsKey(projectId) });
  if (engagementId) {
    qc.invalidateQueries({ queryKey: engTasksKey(engagementId) });
    qc.invalidateQueries({ queryKey: engCostKey(engagementId) });
  }
  // painéis por-tarefa que possam estar abertos em cache (detalhe/timeline/custo) — o lote muda status/existência.
  qc.invalidateQueries({ queryKey: ["task"] });
  qc.invalidateQueries({ queryKey: ["activity"] });
  qc.invalidateQueries({ queryKey: ["task-cost"] });
}

/**
 * Excluir em lote: um POST → um deletionBatchId no backend → um Desfazer (restore de qualquer id do lote).
 * Best-effort: `deletedIds` diz o que realmente saiu (o resto = sem permissão). O toast de Desfazer e o
 * aviso de falha parcial ficam na tela (como no delete unitário). [acoes-em-massa]
 */
export function useBulkDeleteTasks(projectId: string, engagementId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) =>
      (await api.post<{ deletedCount: number; deletedIds: string[] }>(`/tasks/bulk-delete`, { ids })).data,
    onSuccess: () => invalidateBoard(qc, projectId, engagementId),
    onError: (err) => {
      const code = errorCode(err);
      if (code === "SEM_PERMISSAO") toast.error("Você não tem permissão para excluir estas tarefas");
      else toast.error("Não foi possível excluir as tarefas");
    },
  });
}

export interface BulkMoveResult {
  total: number;
  failedIds: string[];
  anyAccessLost: boolean;
}

/**
 * Mudar status/coluna em lote: loop client-side sobre /move (last-write-wins, sem token). Posições
 * pré-calculadas na tela (fim da coluna destino) pra não colidir. Promise.allSettled — aplica o que deu
 * certo e devolve os ids que falharam (a tela mantém só esses selecionados). [acoes-em-massa RF-11/14/16]
 */
export function useBulkMove(projectId: string, engagementId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ moves }: { moves: MoveVars[] }): Promise<BulkMoveResult> => {
      const results = await Promise.allSettled(
        moves.map((m) => api.patch(`/tasks/${m.id}/move`, { status: m.status, position: m.position })),
      );
      const failedIds = moves.filter((_, i) => results[i].status === "rejected").map((m) => m.id);
      const anyAccessLost = results.some(
        (r) => r.status === "rejected" && errorCode((r as PromiseRejectedResult).reason) === "PROJETO_SEM_ACESSO",
      );
      return { total: moves.length, failedIds, anyAccessLost };
    },
    onSettled: (res) => {
      invalidateBoard(qc, projectId, engagementId);
      qc.invalidateQueries({ queryKey: ["tasks", "all"] });
      // se alguém perdeu acesso ao cliente no meio, atualiza a lista de clientes/permissões (como o move unitário)
      if (res?.anyAccessLost) {
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["me"] });
      }
    },
    onError: () => toast.error("Não foi possível mover as tarefas"),
  });
}

// ---- Responsáveis (principal + extras) [detalhe-tarefa A1] ----

interface AssigneeVars {
  taskId: string;
  userId: string;
  engagementId?: string;
}

/**
 * Sucesso de mutação de responsável: escreve o Task fresco no detalhe (instantâneo, fecha a janela de
 * duplo-clique) e invalida listas/custo. onError discrimina perda-de-acesso/tarefa-removida como o move. [review A]
 */
function useAssigneeMutation(
  projectId: string,
  fn: (v: AssigneeVars) => Promise<Task>,
  genericMsg: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      if (data) qc.setQueryData(taskKey(vars.taskId), data); // atualiza o detalhe na hora (sem esperar refetch)
      qc.invalidateQueries({ queryKey: activityKey(vars.taskId) }); // timeline reflete a mudança de responsável
      qc.invalidateQueries({ queryKey: tasksKey(projectId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // visão global reflete a mudança [tarefas-visao-global RF-E5]
      qc.invalidateQueries({ queryKey: taskCostKey(vars.taskId) });
      qc.invalidateQueries({ queryKey: projectCostKey(projectId) });
      if (vars.engagementId) {
        qc.invalidateQueries({ queryKey: engTasksKey(vars.engagementId) });
        qc.invalidateQueries({ queryKey: engCostKey(vars.engagementId) });
      }
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "PROJETO_SEM_ACESSO") {
        toast.error("Seu acesso a este cliente foi removido");
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["me"] });
      } else if (code === "NAO_ENCONTRADO") {
        toast.error("Essa tarefa não existe mais");
      } else if (code === "VALIDACAO") {
        toast.error("Essa pessoa não pode ser adicionada");
      } else if (code === "SEM_PERMISSAO") {
        toast.error("Você não tem permissão para isso");
      } else {
        toast.error(genericMsg);
      }
    },
  });
}

export function useAddAssignee(projectId: string) {
  return useAssigneeMutation(
    projectId,
    async ({ taskId, userId }) => (await api.post<Task>(`/tasks/${taskId}/assignees`, { userId })).data,
    "Não foi possível adicionar o responsável",
  );
}

export function useRemoveAssignee(projectId: string) {
  return useAssigneeMutation(
    projectId,
    async ({ taskId, userId }) => (await api.delete<Task>(`/tasks/${taskId}/assignees/${userId}`)).data,
    "Não foi possível remover o responsável",
  );
}

export function useSetPrimaryAssignee(projectId: string) {
  return useAssigneeMutation(
    projectId,
    async ({ taskId, userId }) => (await api.post<Task>(`/tasks/${taskId}/assignees/${userId}/primary`)).data,
    "Não foi possível definir o responsável principal",
  );
}

// ---- Detalhe + subtarefas ----

export function taskKey(taskId: string | null) {
  return ["task", taskId] as const;
}

export function useTaskDetail(taskId: string | null) {
  return useQuery<Task>({
    queryKey: taskKey(taskId),
    enabled: !!taskId,
    queryFn: async () => (await api.get<Task>(`/tasks/${taskId}`)).data,
    // Sempre refaz no mount: o token de concorrência é semeado do fetch fresco (não do cache velho),
    // evitando o 409 falso ao reabrir a tarefa vinda do board. [fix bug 409]
    refetchOnMount: "always",
  });
}

export function useAddSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) =>
      (
        await api.post(`/tasks/${taskId}/subtasks`, { title }, { headers: { "idempotency-key": idemKey() } })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKey(taskId) });
      qc.invalidateQueries({ queryKey: activityKey(taskId) });
    },
    onError: () => toast.error("Não foi possível adicionar a subtarefa"),
  });
}

export function useToggleSubtask(taskId: string) {
  const qc = useQueryClient();
  const key = taskKey(taskId);
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      (await api.patch(`/subtasks/${id}`, { done })).data,
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Task>(key);
      qc.setQueryData<Task>(key, (old) =>
        old ? { ...old, subtasks: old.subtasks?.map((s) => (s.id === id ? { ...s, done } : s)) } : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error("Não foi possível atualizar a subtarefa");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: activityKey(taskId) });
    },
  });
}

export function useDeleteSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/subtasks/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKey(taskId) });
      qc.invalidateQueries({ queryKey: activityKey(taskId) });
    },
    onError: () => toast.error("Não foi possível remover a subtarefa"),
  });
}
