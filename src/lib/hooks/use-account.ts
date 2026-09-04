import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ChangePasswordInput, UpdateProfileInput } from "@sistema-tasks/contracts";
import { api } from "@/lib/api";

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => (await api.patch("/me", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Perfil atualizado");
    },
    onError: () => toast.error("Não foi possível salvar o perfil"),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => (await api.post("/auth/change-password", input)).data,
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => (await api.delete("/me")).data,
  });
}
