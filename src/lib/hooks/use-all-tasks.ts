import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
