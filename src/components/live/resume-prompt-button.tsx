"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MAX_TITLE = 120;

/**
 * Texto copiado: só título e id. O título é dado do usuário: controles, quebras de linha, caracteres bidi e de
 * largura zero viram espaço (ou somem), «» do próprio título são removidos e o título vai entre «…», para
 * não carregar instruções soltas para dentro do prompt do agente. [design §4, §8]
 */
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]+/g;
export function resumePrompt(title: string, taskId: string): string {
  const clean = title.replace(/[«»]/g, "").replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
  const short = clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1)}…` : clean;
  return `Retome a tarefa «${short}» (${taskId}) no Corex Tasks: leia get_task, responda pendências e continue do próximo passo.`;
}

export function ResumePromptButton({ title, taskId, label = "Copiar pedido de retomada", className }: { title: string; taskId: string; label?: string; className?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(resumePrompt(title, taskId));
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }
  return <Button type="button" variant="outline" size="sm" className={cn("max-md:h-11", className)} onClick={copy}>{label}</Button>;
}
