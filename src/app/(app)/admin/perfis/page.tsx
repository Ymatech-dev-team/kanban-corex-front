"use client";

import { useMemo, useState } from "react";
import { Plus, Loader2, AlertTriangle, ShieldPlus } from "lucide-react";
import type { AxiosError } from "axios";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { toast } from "sonner";
import { useCan } from "@/lib/hooks/use-can";
import { useRoles, useMembers, useDeleteRole, type AdminRole } from "@/lib/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { RoleCard } from "@/components/admin/role-card";
import { RoleEditorDialog } from "@/components/admin/role-editor-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

export default function PerfisPage() {
  const canView = useCan(PERMISSIONS.perfis_ver);
  const canManage = useCan(PERMISSIONS.perfis_gerenciar);
  const canSeeMembers = useCan(PERMISSIONS.membros_ver);
  const roles = useRoles();
  const members = useMembers({ enabled: canSeeMembers }); // só dispara se puder ver membros
  const del = useDeleteRole();

  // Contagem de membros por perfil, derivada no client. undefined quando não temos direito/dado →
  // o card NÃO mostra "0" enganoso (a verdade da exclusão é o servidor). [painel]
  const memberCounts = useMemo(() => {
    if (!canSeeMembers || !members.data) return undefined;
    const m = new Map<string, number>();
    for (const mem of members.data) if (mem.roleId) m.set(mem.roleId, (m.get(mem.roleId) ?? 0) + 1);
    return m;
  }, [canSeeMembers, members.data]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [toDelete, setToDelete] = useState<AdminRole | null>(null);

  if (!canView) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Você não tem acesso a esta área.</p>
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(role: AdminRole) {
    setEditing(role);
    setEditorOpen(true);
  }
  async function doDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      setToDelete(null);
    } catch (e) {
      toast.error(apiMessage(e, "Não foi possível remover o perfil"));
    }
  }

  return (
    <>
      <header className="flex items-center gap-4 border-b border-border px-6 py-3.5">
        <div>
          <h1 className="text-base font-medium tracking-tight">Perfis e permissões</h1>
          <p className="text-[12.5px] text-muted-foreground">Modelos de acesso que você atribui aos membros.</p>
        </div>
        {canManage && (
          <div className="ml-auto">
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Novo perfil
            </Button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6">
        {roles.isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : roles.isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="size-6 text-amber" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar os perfis.</p>
            <Button variant="secondary" onClick={() => roles.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
            {(roles.data ?? []).map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                memberCount={memberCounts?.get(role.id) ?? (memberCounts ? 0 : undefined)}
                canManage={canManage}
                onEdit={() => openEdit(role)}
                onDelete={() => setToDelete(role)}
              />
            ))}
            {/* Estado vazio: nenhum perfil personalizado ainda (o de sistema sempre existe). CTA se puder criar. */}
            {canManage && !(roles.data ?? []).some((r) => !r.isSystem) && (
              <button
                type="button"
                onClick={openCreate}
                className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-4 text-center outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ShieldPlus className="size-5 text-muted-foreground/60" aria-hidden />
                <span className="text-[12.5px] text-muted-foreground">Sem perfis personalizados ainda</span>
                <span className="text-[11.5px] text-muted-foreground/60">
                  Crie um perfil pra reaproveitar em vários membros
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      <RoleEditorDialog open={editorOpen} role={editing} onOpenChange={setEditorOpen} />
      <ConfirmDialog
        open={toDelete !== null}
        title={`Remover o perfil ${toDelete?.name ?? ""}?`}
        description="Se houver membros usando este perfil, reatribua antes. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        danger
        pending={del.isPending}
        onConfirm={doDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      />
    </>
  );
}
