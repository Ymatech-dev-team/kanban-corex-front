import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BoardFilters } from "@/lib/board-filters";

export interface Preset {
  id: string;
  name: string;
  filters: BoardFilters;
  createdAt: string; // ISO
}

export function presetsKey(projectId: string) {
  return ["board-filters", projectId] as const;
}

/** Presets do usuário logado para o cliente. */
export function useBoardPresets(projectId: string) {
  return useQuery<Preset[]>({
    queryKey: presetsKey(projectId),
    queryFn: async () =>
      (await api.get<{ presets: Preset[] }>(`/projects/${projectId}/board-filters`)).data.presets,
    staleTime: 60_000,
  });
}

export function useSavePreset(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; filters: BoardFilters }) =>
      (await api.post<Preset>(`/projects/${projectId}/board-filters`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: presetsKey(projectId) }),
  });
}

export function useUpdatePreset(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; filters?: BoardFilters }) =>
      (
        await api.patch<Preset>(`/projects/${projectId}/board-filters/${input.id}`, {
          name: input.name,
          filters: input.filters,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: presetsKey(projectId) }),
  });
}

export function useDeletePreset(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/projects/${projectId}/board-filters/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: presetsKey(projectId) }),
  });
}
