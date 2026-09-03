import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";

/** "Minhas tarefas" — já interseccionado com os projetos acessíveis no backend. [SEC-107] */
export function useMyTasks() {
  return useQuery<Task[]>({
    queryKey: ["tasks", "mine"],
    queryFn: async () => (await api.get<{ tasks: Task[] }>("/tasks/mine")).data.tasks,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // reavalia prazos a cada 5 min com o app aberto
  });
}
