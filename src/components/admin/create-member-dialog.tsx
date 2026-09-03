"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AxiosError } from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useCreateMember, type AdminRole } from "@/lib/hooks/use-admin";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

interface Props {
  open: boolean;
  roles: AdminRole[];
  onOpenChange: (open: boolean) => void;
  onCreated: (tempPassword: string, memberName: string) => void;
}

export function CreateMemberDialog({ open, roles, onOpenChange, onCreated }: Props) {
  const create = useCreateMember();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setRoleId(null);
      setErr(null);
    }
  }, [open]);

  const roleName = roles.find((r) => r.id === roleId)?.name ?? "Sem perfil";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !email.trim()) return;
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        ...(roleId ? { roleId } : {}),
      });
      onOpenChange(false);
      onCreated(res.tempPassword, res.member.name);
    } catch (e) {
      setErr(apiMessage(e, "Não foi possível criar o membro."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo membro</DialogTitle>
          <DialogDescription>Uma senha temporária é gerada; a pessoa a troca no primeiro acesso.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mname">Nome</Label>
            <Input id="mname" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memail">Email</Label>
            <Input id="memail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Perfil</Label>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring hover:border-muted-foreground/40">
                {roleName}
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuItem active={roleId === null} onSelect={() => setRoleId(null)}>
                  Sem perfil
                </DropdownMenuItem>
                {roles.map((r) => (
                  <DropdownMenuItem key={r.id} active={r.id === roleId} onSelect={() => setRoleId(r.id)}>
                    {r.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || !email.trim() || create.isPending}>
              {create.isPending ? "Criando…" : "Criar membro"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
