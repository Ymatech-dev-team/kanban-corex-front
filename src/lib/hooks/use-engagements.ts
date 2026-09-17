import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorCode, tasksKey } from "@/lib/hooks/use-tasks";
import { projectCostKey } from "@/lib/hooks/use-cost";
import type { Consultor, Engagement } from "@/lib/types";

export function engagementsKey(clientId: string | null) {
  return ["engagements", clientId] as const;
}
export function consultoresKey(engagementId: string | null) {
  return ["consultores", engagementId] as const;
}

export function useEngagements(clientId: string | null) {
  return useQuery<Engagement[]>({
    queryKey: engagementsKey(clientId),
    enabled: !!clientId,
    queryFn: async () =>
      (await api.get<{ engagements: Engagement[] }>(`/projects/${clientId}/engagements`)).data.engagements,
  });
}

export function useCreateEngagement(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) =>
      (await api.post<Engagement>(`/projects/${clientId}/engagements`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: engagementsKey(clientId) });
      toast.success("Projeto criado");
    },
    onError: () => toast.error("Não foi possível criar o projeto"),
  });
}

export function useUpdateEngagement(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; description?: string | null } }) =>
      (await api.patch<Engagement>(`/engagements/${id}`, patch)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: engagementsKey(clientId) });
      toast.success("Projeto atualizado");
    },
    onError: () => toast.error("Não foi possível salvar o projeto"),
  });
}

export function useDeleteEngagement(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/engagements/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: engagementsKey(clientId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // as tarefas do projeto saem da visão global
      qc.invalidateQueries({ queryKey: tasksKey(clientId) }); // métricas do cliente (ClientMetrics) [review]
      qc.invalidateQueries({ queryKey: projectCostKey(clientId) }); // custo agregado do cliente [review]
      // o toast de sucesso vira o toast de "Desfazer", disparado pela tela.
    },
    onError: () => toast.error("Não foi possível excluir o projeto"),
  });
}

/** Desfaz a exclusão do projeto (restaura o lote: projeto + tarefas). [excluir-com-seguranca] */
export function useRestoreEngagement(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/engagements/${id}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: engagementsKey(clientId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] });
      qc.invalidateQueries({ queryKey: tasksKey(clientId) }); // métricas do cliente voltam [review]
      qc.invalidateQueries({ queryKey: projectCostKey(clientId) });
      toast.success("Projeto restaurado");
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "VALIDACAO") toast.error("Não foi possível desfazer: o cliente foi excluído");
      else toast.error("Não foi possível restaurar o projeto");
    },
  });
}

export function useConsultores(engagementId: string | null) {
  return useQuery<Consultor[]>({
    queryKey: consultoresKey(engagementId),
    enabled: !!engagementId,
    queryFn: async () =>
      (await api.get<{ consultores: Consultor[] }>(`/engagements/${engagementId}/consultores`)).data.consultores,
  });
}

export function useAddConsultor(engagementId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => (await api.post(`/engagements/${engagementId}/consultores/${userId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultoresKey(engagementId) });
      qc.invalidateQueries({ queryKey: engagementsKey(clientId) }); // atualiza a contagem no card
    },
    onError: () => toast.error("Não foi possível adicionar o consultor"),
  });
}

export function useRemoveConsultor(engagementId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.delete(`/engagements/${engagementId}/consultores/${userId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultoresKey(engagementId) });
      qc.invalidateQueries({ queryKey: engagementsKey(clientId) });
    },
    onError: () => toast.error("Não foi possível remover o consultor"),
  });
}
