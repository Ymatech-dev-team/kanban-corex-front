import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectCost, TaskCost } from "@/lib/types";

export function projectCostKey(projectId: string | null) {
  return ["project-cost", projectId] as const;
}
export function taskCostKey(taskId: string | null) {
  return ["task-cost", taskId] as const;
}

/**
 * Resumo de custo do cliente. `enabled` deve amarrar canSeeCost === true (o board só habilita
 * quando confirmado). O backend é a barreira: sem direito responde 403 e o interceptor limpa o cache.
 */
export function useProjectCost(projectId: string | null, enabled: boolean) {
  return useQuery<ProjectCost>({
    queryKey: projectCostKey(projectId),
    enabled: !!projectId && enabled,
    queryFn: async () => (await api.get<ProjectCost>(`/projects/${projectId}/cost`)).data,
  });
}

/** Custo de uma tarefa (detalhe). `enabled` só com canSeeCost do cliente da tarefa. */
export function useTaskCost(taskId: string | null, enabled: boolean) {
  return useQuery<TaskCost>({
    queryKey: taskCostKey(taskId),
    enabled: !!taskId && enabled,
    queryFn: async () => (await api.get<TaskCost>(`/tasks/${taskId}/cost`)).data,
  });
}
