"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, Pencil, Trash2, Loader2, AlertTriangle, Lock } from "lucide-react";
import type { AxiosError } from "axios";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { toast } from "sonner";
import { useCan } from "@/lib/hooks/use-can";
import { useRoles, useDeleteRole, type AdminRole } from "@/lib/hooks/use-admin";
import { PERMISSION_LABEL } from "@/lib/permissions-catalog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RoleEditorDialog } from "@/components/admin/role-editor-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

export default function PerfisPage() {
  const canView = useCan(PERMISSIONS.perfis_ver);
  const canManage = useCan(PERMISSIONS.perfis_gerenciar);
  const roles = useRoles();
  const del = useDeleteRole();

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
              <div key={role.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium tracking-tight">{role.name}</h2>
                      {role.isSystem && (
                        <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                          <Lock className="size-2.5" />
                          sistema
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {role.permissions.length} {role.permissions.length === 1 ? "permissão" : "permissões"}
                    </p>
                  </div>
                  {canManage && !role.isSystem && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Ações"
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEdit(role)}>
                          <Pencil className="size-4 text-muted-foreground" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setToDelete(role)}>
                          <Trash2 className="size-4 text-muted-foreground" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {role.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 8).map((p) => (
                      <span key={p} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {PERMISSION_LABEL[p] ?? p}
                      </span>
                    ))}
                    {role.permissions.length > 8 && (
                      <span className="px-1 py-0.5 text-[11px] text-muted-foreground/60">
                        +{role.permissions.length - 8}
                      </span>
                    )}
                  </div>
                )}

                {role.isSystem && (
                  <span className="self-start text-[12px] text-muted-foreground/60">
                    Perfil de sistema — não editável
                  </span>
                )}
              </div>
            ))}
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
