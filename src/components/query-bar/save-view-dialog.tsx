"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MAX_VIEW_NAME } from "@/lib/global-filters";

/** Pede o nome de uma visão (salvar/renomear). Apresentação: quem usa decide onde guardar. */
export function SaveViewDialog({
  open,
  onOpenChange,
  onSubmit,
  initialName = "",
  title = "Salvar visão",
  description = "Guarda os filtros atuais neste navegador.",
  existingNames = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  initialName?: string;
  title?: string;
  description?: string;
  existingNames?: string[];
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setName(initialName); setError(null); }
  }, [open, initialName]);

  function submit() {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) { setError("Dê um nome à visão."); return; }
    const taken = existingNames.some((n) => n.trim().toLowerCase() === clean.toLowerCase() && n !== initialName);
    if (taken) { setError("Já existe uma visão com esse nome."); return; }
    onSubmit(clean);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Input
              autoFocus
              aria-label="Nome da visão"
              value={name}
              maxLength={MAX_VIEW_NAME}
              placeholder="Ex.: IMA esta semana"
              onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
              aria-invalid={!!error}
              aria-describedby={error ? "save-view-error" : undefined}
            />
            {error && <span id="save-view-error" role="alert" className="text-[12px] text-destructive">{error}</span>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
