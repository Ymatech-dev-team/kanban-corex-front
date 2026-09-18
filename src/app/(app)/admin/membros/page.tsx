"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Loader2, AlertTriangle } from "lucide-react";
import type { AxiosError } from "axios";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { toast } from "sonner";
import { useMe } from "@/lib/hooks/use-me";
import { useCan } from "@/lib/hooks/use-can";
import { useMembers, useRoles, useResetPassword, useDeleteMember, type AdminMember } from "@/lib/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/admin/avatar";
import { RoleChip } from "@/components/admin/role-chip";
import { MemberStatus } from "@/components/admin/member-status";
import { CreateMemberDialog } from "@/components/admin/create-member-dialog";
import { EditMemberDialog } from "@/components/admin/edit-member-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";
import { compensationParts } from "@/lib/money";

/** Rótulo do perfil: nome do perfil, "—" se o perfil sumiu, ou null (= "Sem perfil"). */
function roleLabel(roleId: string | null, rolesById: Record<string, string>): string | null {
  return roleId ? rolesById[roleId] ?? "—" : null;
}

/** Célula de remuneração — valor em destaque, sufixo (/h, /mês) muted; "—" quando não definida. */
function Compensation({ type, cents }: { type: string | null; cents: number | null }) {
  const c = compensationParts(type, cents);
  if (!c) return <span className="text-[12px] text-muted-foreground/50">—</span>;
  return (
    <span className="text-[12.5px] text-foreground">
      {c.value}
      <span className="text-muted-foreground">{c.suffix}</span>
    </span>
  );
}

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
  const [editMember, setEditMember] = useState<AdminMember | null>(null);
  const [resetMember, setResetMember] = useState<AdminMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<AdminMember | null>(null);

  const rolesById = useMemo(
    () => Object.fromEntries((roles.data ?? []).map((r) => [r.id, r.name])),
    [roles.data],
  );

  // Ordena por nome (pt-BR, case-insensitive, estável) — some com o "pula" da ordem do backend. [painel]
  const sorted = useMemo(
    () => [...(members.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [members.data],
  );
  // Resumo factual: total + quantos em onboarding (senha temporária). Sem "admins", sem agregado de $. [painel]
  const tempCount = sorted.filter((m) => m.mustChangePassword).length;
  const summary =
    sorted.length === 0
      ? null
      : `${sorted.length} ${sorted.length === 1 ? "membro" : "membros"}` +
        (tempCount > 0 ? ` · ${tempCount} com senha temporária` : "");

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
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Nenhum membro ainda.</p>
            {canManage && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Novo membro
              </Button>
            )}
          </div>
        ) : (
          <>
            {summary && <p className="mb-3 px-1 text-[12px] text-muted-foreground">{summary}</p>}

            {/* Mobile: cards (mesma info da tabela). Só o lápis abre editar, como no desktop. [shell-mobile] */}
            <ul className="flex flex-col gap-2.5 lg:hidden">
              {sorted.map((m) => (
                <li key={m.id}>
                  <MemberCard
                    m={m}
                    rolesReady={roles.isSuccess}
                    rolesError={roles.isError}
                    roleName={roleLabel(m.roleId, rolesById)}
                    canManage={canManage}
                    isSelf={m.id === me.data?.userId}
                    onEdit={() => setEditMember(m)}
                  />
                </li>
              ))}
            </ul>

            {/* Desktop: tabela */}
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
              <table className="w-full min-w-[620px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground/70">
                    <th className="px-4 py-2.5 font-medium">Membro</th>
                    <th className="px-4 py-2.5 font-medium">Perfil</th>
                    {canManage && <th className="px-4 py-2.5 font-medium">Remuneração</th>}
                    <th className="px-4 py-2.5 font-medium">Situação</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m) => {
                    const isSelf = m.id === me.data?.userId;
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.name} size="sm" />
                            <div className="leading-tight">
                              <div className="font-medium">
                                {m.name}
                                {isSelf && (
                                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">você</span>
                                )}
                              </div>
                              <div className="text-[12px] text-muted-foreground">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {roles.isSuccess ? (
                            <RoleChip roleName={roleLabel(m.roleId, rolesById)} extraCount={m.extraPermissions.length} />
                          ) : roles.isError ? (
                            <span className="text-muted-foreground/60">—</span>
                          ) : (
                            <span className="inline-block h-4 w-20 animate-pulse rounded bg-border" />
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <Compensation type={m.compensationType} cents={m.compensationCents} />
                          </td>
                        )}
                        <td className="px-4 py-3 text-[12px]">
                          <MemberStatus mustChangePassword={m.mustChangePassword} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setEditMember(m)}
                              aria-label={`Editar ${m.name}`}
                              title="Editar"
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Pencil className="size-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CreateMemberDialog
        open={createOpen}
        roles={roles.data ?? []}
        onOpenChange={setCreateOpen}
        onCreated={(pw, name) => setReveal({ password: pw, name })}
      />
      <EditMemberDialog
        member={editMember}
        roles={roles.data ?? []}
        isSelf={!!editMember && editMember.id === me.data?.userId}
        canManage={canManage}
        onOpenChange={(o) => !o && setEditMember(null)}
        onResetPassword={(m) => {
          setEditMember(null);
          setResetMember(m);
        }}
        onDelete={(m) => {
          setEditMember(null);
          setDeleteMember(m);
        }}
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

/** Card de membro no mobile (ficha rotulada). Mesma info da linha da tabela; só o lápis abre editar. */
function MemberCard({
  m,
  rolesReady,
  rolesError,
  roleName,
  canManage,
  isSelf,
  onEdit,
}: {
  m: AdminMember;
  rolesReady: boolean;
  rolesError: boolean;
  roleName: string | null;
  canManage: boolean;
  isSelf: boolean;
  onEdit: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <Avatar name={m.name} size="md" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-medium">
            {m.name}
            {isSelf && <span className="ml-2 text-[11px] font-normal text-muted-foreground">você</span>}
          </div>
          <div className="truncate text-[12px] text-muted-foreground">{m.email}</div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${m.name}`}
            title="Editar"
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3 text-[12.5px]">
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Perfil</dt>
          <dd className="flex min-w-0 items-center justify-end gap-2">
            {rolesReady ? (
              <RoleChip roleName={roleName} extraCount={m.extraPermissions.length} />
            ) : rolesError ? (
              <span className="text-muted-foreground/60">—</span>
            ) : (
              <span className="inline-block h-4 w-20 animate-pulse rounded bg-border" />
            )}
          </dd>
        </div>
        {canManage && (
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">Remuneração</dt>
            <dd className="text-right">
              <Compensation type={m.compensationType} cents={m.compensationCents} />
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Situação</dt>
          <dd>
            <MemberStatus mustChangePassword={m.mustChangePassword} />
          </dd>
        </div>
      </dl>
    </article>
  );
}
