import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Me {
  userId: string;
  orgId: string;
  name: string;
  email: string;
  permissions: string[];
  mustChangePassword: boolean;
}

/** Sessão + permissões efetivas do usuário logado (fonte da verdade da UI). */
export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/me")).data,
    retry: false,
    staleTime: 30_000,
  });
}
