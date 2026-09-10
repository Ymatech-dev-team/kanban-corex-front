import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TaskActivity } from "@/lib/types";

export function activityKey(taskId: string | null) {
  return ["activity", taskId] as const;
}

function idemKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export { idemKey };

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    // a chave vem de FORA (estável por tentativa) — reenvio usa a MESMA chave, sem duplicar. [review C2]
    mutationFn: async ({ body, key }: { body: string; key: string }) =>
      (await api.post(`/tasks/${taskId}/comments`, { body }, { headers: { "idempotency-key": key } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: activityKey(taskId) }),
    // erro tratado na UI (mantém o rascunho pra reenviar) — sem toast genérico aqui
  });
}

export function useEditComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) =>
      (await api.patch(`/tasks/${taskId}/comments/${commentId}`, { body })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: activityKey(taskId) }),
    onError: () => toast.error("Não foi possível editar o comentário"),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => (await api.delete(`/tasks/${taskId}/comments/${commentId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: activityKey(taskId) }),
    onError: () => toast.error("Não foi possível remover o comentário"),
  });
}
