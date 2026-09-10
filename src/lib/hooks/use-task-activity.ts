import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskActivity } from "@/lib/types";

export function activityKey(taskId: string | null) {
  return ["activity", taskId] as const;
}

interface ActivityPage {
  items: TaskActivity[];
  nextCursor: string | null;
}

/** Feed paginado (keyset) da linha do tempo. Só busca quando `enabled` (aba Atividade aberta). */
export function useTaskActivity(taskId: string | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: activityKey(taskId),
    enabled: enabled && !!taskId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<ActivityPage>(`/tasks/${taskId}/activity`, {
          params: { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
        })
      ).data,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}
