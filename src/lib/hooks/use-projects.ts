import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<{ projects: Project[] }>("/projects")).data.projects,
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
