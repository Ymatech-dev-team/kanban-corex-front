import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { api } from "@/lib/api";
import { errorCode } from "@/lib/hooks/use-tasks";
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
    mutationFn: async ({ id, status, position }: { id: string; status: TaskStatus; position: number }) =>
      (await api.patch<Task>(`/tasks/${id}/move`, { status, position })).data,
    onMutate: async ({ id, status, position }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AllTasksResponse>(key);
      qc.setQueryData<AllTasksResponse>(key, (old) =>
        old ? { ...old, tasks: old.tasks.map((t) => (t.id === id ? { ...t, status, position } : t)) } : old,
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev); // rollback
      const code = errorCode(err);
      if (code === "PROJETO_SEM_ACESSO") toast.error("Seu acesso a este cliente foi removido");
      else if (code === "TAREFA_REMOVIDA") toast.error("Essa tarefa foi removida");
      else if (code === "SEM_PERMISSAO") toast.error("Você não tem permissão para mover tarefas");
      else toast.error("Não foi possível mover a tarefa");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] }); // global + listas por projeto
      qc.invalidateQueries({ queryKey: ["eng-tasks"] }); // board por engagement
    },
  });
}
