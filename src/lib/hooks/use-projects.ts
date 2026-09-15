import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorCode, tasksKey } from "@/lib/hooks/use-tasks";
import type { Project } from "@/lib/types";

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<{ projects: Project[] }>("/projects")).data.projects,
  });
}

export function projectKey(id: string | null) {
  return ["project", id] as const;
}

/**
 * Detalhe de um cliente — traz `canSeeCost` (permissão de custo POR cliente).
 * Fonte única do sinal, consumida pelo board e pelo diálogo (mesma chave = sem fetch extra).
 * staleTime curto: carrega um gate de permissão, então revalida logo na retomada de foco.
 */
export function useProject(id: string | null) {
  return useQuery<Project>({
    queryKey: projectKey(id),
    enabled: !!id,
    staleTime: 10_000,
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) =>
      (await api.post<Project>("/projects", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/**
 * Excluir CLIENTE (soft-delete em cascata no backend: leva projetos+tarefas). Gated por
 * `projetos_excluir`. Invalida o que tem observers vivos (lista de clientes, visão global) e REMOVE
 * as chaves do cliente morto — senão o staleTime do useProject serviria o cliente excluído ao voltar.
 * Chaves em literais pra evitar import circular (padrão do projeto). [painel]
 */
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/projects/${id}`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["projects"] }); // lista de clientes
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // visão global
      qc.removeQueries({ queryKey: projectKey(id) }); // detalhe
      qc.removeQueries({ queryKey: tasksKey(id) }); // tarefas do cliente
      qc.removeQueries({ queryKey: ["engagements", id] }); // projetos do cliente
      qc.removeQueries({ queryKey: ["members", id] });
      qc.removeQueries({ queryKey: ["project-cost", id] });
      toast.success("Cliente excluído");
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "SEM_PERMISSAO") toast.error("Você não tem permissão para excluir clientes");
      else if (code === "NAO_ENCONTRADO") toast.error("Este cliente já não existe");
      else toast.error("Não foi possível excluir o cliente");
    },
  });
}
