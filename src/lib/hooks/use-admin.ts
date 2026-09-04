import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateMemberInput,
  UpdateMemberInput,
  SetCompensationInput,
  CreateRoleInput,
  UpdateRoleInput,
} from "@sistema-tasks/contracts";
import { api } from "@/lib/api";

export interface AdminMember {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  extraPermissions: string[];
  mustChangePassword: boolean;
  compensationType: "MONTHLY" | "HOURLY" | null;
  compensationCents: number | null;
}

export interface AdminRole {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
}

export function useMembers() {
  return useQuery<AdminMember[]>({
    queryKey: ["members"],
    queryFn: async () => (await api.get<{ members: AdminMember[] }>("/members")).data.members,
  });
}

export function useRoles() {
  return useQuery<AdminRole[]>({
    queryKey: ["roles"],
    queryFn: async () => (await api.get<{ roles: AdminRole[] }>("/roles")).data.roles,
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMemberInput) =>
      (await api.post<{ member: AdminMember; tempPassword: string }>("/members", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateMemberInput }) =>
      (await api.patch(`/members/${id}`, patch)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Membro atualizado");
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRoleInput) => (await api.post<AdminRole>("/roles", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Perfil criado");
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateRoleInput }) =>
      (await api.patch(`/roles/${id}`, patch)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Perfil atualizado");
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/roles/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Perfil removido");
    },
  });
}

export function useSetCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SetCompensationInput }) =>
      (await api.patch(`/members/${id}/compensation`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Remuneração atualizada");
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ tempPassword: string }>(`/members/${id}/reset-password`)).data,
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/members/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Membro removido");
    },
  });
}
