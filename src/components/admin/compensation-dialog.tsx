"use client";

import { useEffect, useState } from "react";
import type { AxiosError } from "axios";
import type { CompensationType } from "@sistema-tasks/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetCompensation, type AdminMember } from "@/lib/hooks/use-admin";
import { parseReaisToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

const TYPES: { value: CompensationType; label: string; suffix: string }[] = [
  { value: "MONTHLY", label: "Salário mensal", suffix: "por mês" },
  { value: "HOURLY", label: "Valor por hora", suffix: "por hora" },
];

export function CompensationDialog({
  member,
  onOpenChange,
}: {
  member: AdminMember | null;
  onOpenChange: (open: boolean) => void;
}) {
  const set = useSetCompensation();
  const [type, setType] = useState<CompensationType>("MONTHLY");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setType(member.compensationType ?? "MONTHLY");
      setAmount(
        member.compensationCents != null ? String(member.compensationCents / 100).replace(".", ",") : "",
      );
      setErr(null);
    }
  }, [member]);

  if (!member) return null;
  const hasComp = member.compensationType != null;
  const suffix = TYPES.find((t) => t.value === type)!.suffix;

  async function save() {
    if (!member) return;
    setErr(null);
    const cents = parseReaisToCents(amount);
    if (cents == null) {
      setErr("Informe um valor válido (ex.: 2500 ou 40,50).");
      return;
    }
    try {
      await set.mutateAsync({ id: member.id, input: { type, amountCents: cents } });
      onOpenChange(false);
    } catch (e) {
      setErr(apiMessage(e, "Não foi possível salvar."));
    }
  }

  async function clear() {
    if (!member) return;
    setErr(null);
    try {
      await set.mutateAsync({ id: member.id, input: { type: null, amountCents: null } });
      onOpenChange(false);
    } catch (e) {
      setErr(apiMessage(e, "Não foi possível remover."));
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remuneração de {member.name}</DialogTitle>
          <DialogDescription>
            Usado para calcular o custo de alocar a pessoa nos projetos. Só quem gerencia membros vê este valor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Tipo</Label>
          <div className="flex gap-0.5 rounded-lg border border-border bg-card p-[3px]">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                  type === t.value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Valor</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
              R$
            </span>
            <Input
              id="amount"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === "MONTHLY" ? "2500,00" : "40,00"}
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">{suffix}</p>
        </div>

        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {hasComp ? (
            <Button type="button" variant="secondary" onClick={clear} disabled={set.isPending} className="text-amber">
              Remover
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={!amount.trim() || set.isPending}>
              {set.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
