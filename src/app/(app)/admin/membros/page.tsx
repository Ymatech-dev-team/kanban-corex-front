"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Plus, ShieldCheck, KeyRound, Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { AxiosError } from "axios";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { toast } from "sonner";
import { useMe } from "@/lib/hooks/use-me";
import { useCan } from "@/lib/hooks/use-can";
import { useMembers, useRoles, useResetPassword, useDeleteMember, type AdminMember } from "@/lib/hooks/use-admin";
import { initials } from "@/lib/initials";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CreateMemberDialog } from "@/components/admin/create-member-dialog";
import { ChangeRoleDialog } from "@/components/admin/change-role-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

export default function MembrosPage() {
  const me = useMe();
  const canView = useCan(PERMISSIONS.membros_ver);
  const canManage = useCan(PERMISSIONS.membros_gerenciar);
  const members = useMembers();
  const roles = useRoles();
  const reset = useResetPassword();
  const del = useDeleteMember();

  const [createOpen, setCreateOpen] = useState(false);
  const [reveal, setReveal] = useState<{ password: string; name: string } | null>(null);
  const [roleMember, setRoleMember] = useState<AdminMember | null>(null);
  const [resetMember, setResetMember] = useState<AdminMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<AdminMember | null>(null);

  const rolesById = useMemo(
    () => Object.fromEntries((roles.data ?? []).map((r) => [r.id, r.name])),
    [roles.data],
  );

  if (!canView) {
    return (
      <Centered>
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Você não tem acesso a esta área.</p>
      </Centered>
    );
  }

  async function doReset() {
    if (!resetMember) return;
    try {
      const res = await reset.mutateAsync(resetMember.id);
      const name = resetMember.name;
      setResetMember(null);
      setReveal({ password: res.tempPassword, name });
    } catch (e) {
      toast.error(apiMessage(e, "Não foi possível redefinir a senha"));
    }
  }

  async function doDelete() {
    if (!deleteMember) return;
    try {
      await del.mutateAsync(deleteMember.id);
      setDeleteMember(null);
    } catch (e) {
      toast.error(apiMessage(e, "Não foi possível remover o membro"));
    }
  }

  return (
    <>
      <header className="flex items-center gap-4 border-b border-border px-6 py-3.5">
        <div>
          <h1 className="text-base font-medium tracking-tight">Membros</h1>
          <p className="text-[12.5px] text-muted-foreground">Quem acessa o sistema e com qual perfil.</p>
        </div>
        {canManage && (
          <div className="ml-auto">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Novo membro
            </Button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6">
        {members.isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : members.isError ? (
          <Centered>
            <AlertTriangle className="size-6 text-amber" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar os membros.</p>
            <Button variant="secondary" onClick={() => members.refetch()}>
              Tentar de novo
            </Button>
          </Centered>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[620px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  <th className="px-4 py-2.5 font-medium">Membro</th>
                  <th className="px-4 py-2.5 font-medium">Perfil</th>
                  <th className="px-4 py-2.5 font-medium">Situação</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(members.data ?? []).map((m) => {
                  const isSelf = m.id === me.data?.userId;
                  return (
                    <tr key={m.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[11px] font-medium text-foreground">
                            {initials(m.name)}
                          </span>
                          <div className="leading-tight">
                            <div className="font-medium">
                              {m.name}
                              {isSelf && <span className="ml-2 text-[11px] text-muted-foreground">você</span>}
                            </div>
                            <div className="text-[12px] text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.roleId ? rolesById[m.roleId] ?? "—" : "Sem perfil"}
                        {m.extraPermissions.length > 0 && (
                          <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10.5px]">
                            +{m.extraPermissions.length} extra
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.mustChangePassword ? (
                          <span className="text-[12px] text-amber">senha temporária</span>
                        ) : (
                          <span className="text-[12px] text-muted-foreground/60">ativo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label="Ações"
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isSelf && (
                                <DropdownMenuItem onSelect={() => setRoleMember(m)}>
                                  <ShieldCheck className="size-4 text-muted-foreground" />
                                  Alterar perfil
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onSelect={() => setResetMember(m)}>
                                <KeyRound className="size-4 text-muted-foreground" />
                                Redefinir senha
                              </DropdownMenuItem>
                              {!isSelf && (
                                <DropdownMenuItem onSelect={() => setDeleteMember(m)}>
                                  <Trash2 className="size-4 text-muted-foreground" />
                                  Remover
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateMemberDialog
        open={createOpen}
        roles={roles.data ?? []}
        onOpenChange={setCreateOpen}
        onCreated={(pw, name) => setReveal({ password: pw, name })}
      />
      <ChangeRoleDialog
        member={roleMember}
        roles={roles.data ?? []}
        onOpenChange={(o) => !o && setRoleMember(null)}
      />
      <ConfirmDialog
        open={resetMember !== null}
        title={`Redefinir senha de ${resetMember?.name ?? ""}?`}
        description="Uma nova senha temporária é gerada e a sessão atual da pessoa é encerrada."
        confirmLabel="Redefinir"
        pending={reset.isPending}
        onConfirm={doReset}
        onOpenChange={(o) => !o && setResetMember(null)}
      />
      <ConfirmDialog
        open={deleteMember !== null}
        title={`Remover ${deleteMember?.name ?? ""}?`}
        description="A pessoa perde o acesso e deixa de ser responsável pelas tarefas. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        danger
        pending={del.isPending}
        onConfirm={doDelete}
        onOpenChange={(o) => !o && setDeleteMember(null)}
      />
      <TempPasswordDialog
        password={reveal?.password ?? null}
        memberName={reveal?.name}
        onClose={() => setReveal(null)}
      />
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">{children}</div>;
}
