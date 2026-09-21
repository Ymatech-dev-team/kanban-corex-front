import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ChangePasswordInput, UpdateProfileInput } from "@sistema-tasks/contracts";
import { api } from "@/lib/api";
import { fileToAvatarDataUrl, ImageError } from "@/lib/image";
import type { Me } from "@/lib/hooks/use-me";

/** Mensagem amigável: erro de validação do client (ImageError) OU a mensagem do backend (Axios 400). */
function avatarError(e: unknown): string {
  if (e instanceof ImageError) return e.message;
  const msg = (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message;
  return msg ?? "Não foi possível enviar a foto";
}

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

/** Foto de perfil: redimensiona no client e sobe; o backend re-encoda (sharp) e devolve a URL pública. */
export function useSetAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const imageBase64 = await fileToAvatarDataUrl(file);
      // timeout pra não deixar o spinner preso se a rede travar
      return (await api.post<{ avatarUrl: string }>("/me/avatar", { imageBase64 }, { timeout: 30_000 })).data;
    },
    onSuccess: (data) => {
      qc.setQueryData<Me>(["me"], (old) => (old ? { ...old, avatarUrl: data.avatarUrl } : old));
      toast.success("Foto atualizada");
    },
    onError: (e) => toast.error(avatarError(e)),
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete("/me/avatar")).data,
    onSuccess: () => {
      qc.setQueryData<Me>(["me"], (old) => (old ? { ...old, avatarUrl: null } : old));
      toast.success("Foto removida");
    },
    onError: () => toast.error("Não foi possível remover a foto"),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => (await api.delete("/me")).data,
  });
}
