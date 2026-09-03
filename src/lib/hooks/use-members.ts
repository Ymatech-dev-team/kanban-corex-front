import { useQuery } from "@tanstack/react-query";
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
