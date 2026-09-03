"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Lock } from "lucide-react";
import type { AxiosError } from "axios";
import { META_PERMISSIONS, type Permission } from "@sistema-tasks/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/lib/hooks/use-me";
import { useCreateRole, useUpdateRole, type AdminRole } from "@/lib/hooks/use-admin";
import { PERMISSION_GROUPS } from "@/lib/permissions-catalog";
import { cn } from "@/lib/utils";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

interface Props {
  open: boolean;
  role: AdminRole | null; // null = criar
  onOpenChange: (open: boolean) => void;
}

export function RoleEditorDialog({ open, role, onOpenChange }: Props) {
  const me = useMe();
  const create = useCreateRole();
  const update = useUpdateRole();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmMeta, setConfirmMeta] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setSelected(new Set(role?.permissions ?? []));
      setConfirmMeta(false);
      setErr(null);
    }
  }, [open, role]);

  const userHas = useMemo(() => new Set(me.data?.permissions ?? []), [me.data]);

  // Adiciona meta-permissão que o perfil ainda não tinha? (só relevante na edição)
  const addsMeta = useMemo(() => {
    if (!role) return false;
    return (META_PERMISSIONS as string[]).some((m) => selected.has(m) && !role.permissions.includes(m));
  }, [selected, role]);

  function toggle(perm: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  async function save() {
    setErr(null);
    if (!name.trim()) return;
    const permissions = [...selected] as Permission[];
    try {
      if (role) {
        await update.mutateAsync({
          id: role.id,
          patch: { name: name.trim(), permissions, ...(addsMeta ? { confirmMetaPermission: true } : {}) },
        });
      } else {
        await create.mutateAsync({ name: name.trim(), permissions });
      }
      onOpenChange(false);
    } catch (e) {
      setErr(apiMessage(e, "Não foi possível salvar o perfil."));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? `Editar ${role.name}` : "Novo perfil"}</DialogTitle>
          <DialogDescription>Marque o que este perfil permite fazer.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rname">Nome do perfil</Label>
          <Input id="rname" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>

        <div className="flex flex-col gap-4">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{group.title}</span>
              {group.items.map((item) => {
                const checked = selected.has(item.perm);
                const canGrant = userHas.has(item.perm);
                const locked = !canGrant && checked; // perfil já tem, mas você não pode conceder
                const disabled = !canGrant;
                return (
                  <button
                    key={item.perm}
                    type="button"
                    disabled={disabled}
                    onClick={() => canGrant && toggle(item.perm)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                      checked ? "border-muted-foreground/40 bg-accent" : "border-border",
                      canGrant ? "hover:border-muted-foreground/30" : "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/50 text-transparent",
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px]">
                        {item.label}
                        {item.meta && (
                          <span className="rounded border border-amber/40 px-1 py-0 text-[10px] text-amber">admin</span>
                        )}
                        {locked && <Lock className="size-3 text-muted-foreground/60" />}
                      </span>
                      {item.hint && <span className="block text-[11.5px] text-muted-foreground">{item.hint}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
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
              Este perfil passa a conceder <span className="text-foreground">permissões de administração</span>.
              Confirmo a mudança.
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
          <Button type="button" onClick={save} disabled={!name.trim() || (addsMeta && !confirmMeta) || pending}>
            {pending ? "Salvando…" : role ? "Salvar" : "Criar perfil"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
