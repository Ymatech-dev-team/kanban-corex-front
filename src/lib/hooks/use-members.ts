import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Member } from "@/lib/types";

/** Quem tem acesso ao cliente — a lista de possíveis responsáveis. [SEC-107] */
export function useProjectMembers(projectId: string | null) {
  return useQuery<Member[]>({
    queryKey: ["members", projectId],
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async () => (await api.get<{ members: Member[] }>(`/projects/${projectId}/members`)).data.members,
  });
}

/** Concede acesso de um usuário ao cliente (exige permissoes_conceder). */
export function useGrantAccess(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => (await api.post(`/projects/${projectId}/members/${userId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", projectId] });
      toast.success("Acesso concedido");
    },
    onError: () => toast.error("Não foi possível conceder acesso"),
  });
}

/** Revoga o acesso — reatribui responsáveis das tarefas do cliente (backend), então invalida o board. */
export function useRevokeAccess(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => (await api.delete(`/projects/${projectId}/members/${userId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task"] });
      qc.invalidateQueries({ queryKey: ["engagements", projectId] });
      toast.success("Acesso removido");
    },
    onError: () => toast.error("Não foi possível remover o acesso"),
  });
}
