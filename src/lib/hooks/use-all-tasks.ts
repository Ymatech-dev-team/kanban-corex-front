import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorCode, type MoveVars } from "@/lib/hooks/use-tasks";
import type { Task } from "@/lib/types";

/** Chave da lista GLOBAL. Prefixo ["tasks","all"] é o alvo da invalidação cross-query das mutações. [RF-E5] */
export function allTasksKey(query: Record<string, string>) {
  return ["tasks", "all", query] as const;
}

interface AllTasksResponse {
  tasks: Task[];
  hasMore: boolean;
}

export function useAllTasks(query: Record<string, string>) {
  return useQuery<AllTasksResponse>({
    queryKey: allTasksKey(query),
    queryFn: async () => (await api.get<AllTasksResponse>("/tasks", { params: query })).data,
  });
}

/** Mover no Kanban GLOBAL: otimista na lista agregada, rollback no erro, invalida board + global. [tarefas-visao-global] */
export function useGlobalMoveTask(query: Record<string, string>) {
  const qc = useQueryClient();
  const key = allTasksKey(query);
  return useMutation({
    mutationFn: async ({ id, status, position, updatedAt, operationId }: MoveVars) =>
      (await api.patch<Task>(`/tasks/${id}/move`, { status, position }, { headers: { "idempotency-key": operationId ?? crypto.randomUUID(), ...(updatedAt ? { "x-expected-updated-at": updatedAt } : {}) } })).data,
    onMutate: async ({ id, status, position }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AllTasksResponse>(key);
      qc.setQueryData<AllTasksResponse>(key, (old) =>
        old ? { ...old, tasks: old.tasks.map((t) => (t.id === id ? { ...t, status, position } : t)) } : old,
      );
      return { previous: prev?.tasks.find(task => task.id === id) };
    },
    onSuccess: (data, vars) => {
      qc.setQueryData<AllTasksResponse>(key, old => old ? { ...old, tasks: old.tasks.map(task => task.id === vars.id ? data : task) } : old);
      qc.setQueryData(["task", vars.id], data);
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData<AllTasksResponse>(key, old => old ? { ...old, tasks: old.tasks.map(task => task.id === vars.id ? ctx.previous! : task) } : old);
      const code = errorCode(err);
      if (code === "PROJETO_SEM_ACESSO") toast.error("Seu acesso a este cliente foi removido");
      else if (code === "TAREFA_REMOVIDA") toast.error("Essa tarefa foi removida");
      else if (code === "SEM_PERMISSAO") toast.error("Você não tem permissão para mover tarefas");
      else if (code === "CONFLITO") toast.error("A tarefa mudou durante o movimento. O quadro será atualizado.");
      else toast.error("Não foi possível mover a tarefa");
    },
    onSettled: (_data, _error, vars) => {
      for (const prefix of ["workflow", "workflow-actions", "workflow-monitoring", "activity", "task-cost", "project-cost", "eng-cost"]) qc.invalidateQueries({ queryKey: [prefix] });
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] }); // global + listas por projeto
      qc.invalidateQueries({ queryKey: ["eng-tasks"] }); // board por engagement
    },
  });
}
