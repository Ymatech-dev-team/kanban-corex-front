"use client";

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode; // aceita cascata composta ("Isto remove 3 projetos e 12 tarefas.")
  reversible?: boolean; // mostra a nota honesta de "dá pra desfazer" (substitui "não pode ser desfeito")
  confirmLabel?: string;
  pendingLabel?: string; // rótulo enquanto envia (ex.: "Excluindo…"); default "Aguarde…"
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  reversible,
  confirmLabel = "Confirmar",
  pendingLabel = "Aguarde…",
  danger,
  pending,
  onConfirm,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {reversible && (
          <div className="flex items-start gap-2 rounded-r-lg border-l-2 border-primary bg-accent/50 py-2 pl-3 pr-3 text-[12.5px] text-foreground/90">
            <RotateCcw className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              Você poderá <span className="text-primary">desfazer</span> por alguns segundos depois de excluir.
            </span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending} variant={danger ? "danger" : "default"}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
