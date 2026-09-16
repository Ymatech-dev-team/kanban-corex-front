import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Notificação de "tarefa atribuída a você" (outra pessoa te atribuiu). Deriva da atividade no back. */
export interface AssignmentNotification {
  id: string; // id do evento — chave estável do "visto"
  taskId: string;
  title: string;
  actorName: string; // quem atribuiu
  type: "ASSIGNEE_ADDED" | "PRIMARY_CHANGED";
  createdAt: string; // ISO
}

/** Atribuições recentes ao usuário logado. Polling leve (5 min), igual aos prazos. */
export function useMyNotifications() {
  return useQuery<AssignmentNotification[]>({
    queryKey: ["notifications", "mine"],
    queryFn: async () =>
      (await api.get<{ notifications: AssignmentNotification[] }>("/notifications/mine")).data.notifications,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
