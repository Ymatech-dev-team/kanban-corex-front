import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
