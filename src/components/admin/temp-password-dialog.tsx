"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  password: string | null;
  memberName?: string;
  onClose: () => void;
}

export function TempPasswordDialog({ password, memberName, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — o valor segue visível pra copiar à mão */
    }
  }

  return (
    <Dialog open={password !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Senha temporária</DialogTitle>
          <DialogDescription>
            {memberName ? `Entregue a ${memberName}. ` : ""}
            Ela troca a senha no primeiro acesso. Esta é a única vez que ela aparece.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code className="flex-1 select-all rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-[15px] tracking-wide">
            {password}
          </code>
          <Button type="button" variant="secondary" onClick={copy} className="shrink-0">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <div className="flex justify-end pt-1">
          <Button type="button" onClick={onClose}>
            Concluído
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
