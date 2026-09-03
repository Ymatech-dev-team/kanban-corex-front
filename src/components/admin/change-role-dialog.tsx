"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { AxiosError } from "axios";
import { META_PERMISSIONS } from "@sistema-tasks/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateMember, type AdminMember, type AdminRole } from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

interface Props {
  member: AdminMember | null;
  roles: AdminRole[];
  onOpenChange: (open: boolean) => void;
}

export function ChangeRoleDialog({ member, roles, onOpenChange }: Props) {
  const update = useUpdateMember();
  const [roleId, setRoleId] = useState<string | null>(null);
  const [confirmMeta, setConfirmMeta] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setRoleId(member.roleId);
      setConfirmMeta(false);
      setErr(null);
    }
  }, [member]);

  // Permissões de admin que já valem hoje (perfil atual + extras).
  const currentMeta = useMemo(() => {
    if (!member) return new Set<string>();
    const currentRole = roles.find((r) => r.id === member.roleId);
    const eff = new Set([...(currentRole?.permissions ?? []), ...member.extraPermissions]);
    return new Set(META_PERMISSIONS.filter((m) => eff.has(m)));
  }, [member, roles]);

  const newRole = roles.find((r) => r.id === roleId) ?? null;
  const addsMeta = useMemo(() => {
    const perms = new Set(newRole?.permissions ?? []);
    return META_PERMISSIONS.some((m) => perms.has(m) && !currentMeta.has(m));
  }, [newRole, currentMeta]);

  if (!member) return null;
  const changed = roleId !== member.roleId;

  async function save() {
    if (!member) return;
    setErr(null);
    try {
      await update.mutateAsync({
        id: member.id,
        patch: { roleId, ...(addsMeta ? { confirmMetaPermission: true } : {}) },
      });
      onOpenChange(false);
    } catch (e) {
      setErr(apiMessage(e, "Não foi possível alterar o perfil."));
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Perfil de {member.name}</DialogTitle>
          <DialogDescription>O perfil define o que a pessoa pode fazer no sistema.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setRoleId(null)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors",
              roleId === null ? "border-muted-foreground/40 bg-accent" : "border-border hover:border-muted-foreground/30",
            )}
          >
            <span>
              <span className="font-medium">Sem perfil</span>
              <span className="ml-2 text-muted-foreground">acesso mínimo</span>
            </span>
            {roleId === null && <Check className="size-4 text-primary" />}
          </button>
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoleId(r.id)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors",
                roleId === r.id ? "border-muted-foreground/40 bg-accent" : "border-border hover:border-muted-foreground/30",
              )}
            >
              <span>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-muted-foreground">{r.permissions.length} permissões</span>
              </span>
              {roleId === r.id && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>

        {addsMeta && (
          <button
            type="button"
            onClick={() => setConfirmMeta((v) => !v)}
            className="flex items-start gap-2.5 rounded-lg border border-amber/40 bg-amber/5 px-3 py-2.5 text-left"
          >
            <span
              className={cn(
                "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                confirmMeta ? "border-amber bg-amber text-primary-foreground" : "border-muted-foreground/50 text-transparent",
              )}
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              Este perfil concede <span className="text-foreground">permissões de administração</span>. Confirmo que
              quero dar esse nível de acesso a {member.name}.
            </span>
          </button>
        )}

        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={!changed || (addsMeta && !confirmMeta) || update.isPending}>
            {update.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
