"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { httpStatus } from "@/lib/http-error";
import { useWorkflowWrite, workflowKey, workflowMessage, type WorkflowAction, type WorkflowSnapshot } from "@/lib/hooks/use-workflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResumePromptButton } from "@/components/live";
import { cn } from "@/lib/utils";

export interface ActionResponseProps {
  taskId: string;
  taskTitle: string;
  action: WorkflowAction;
  /** true na linha da Agora; false na folha. */
  compact?: boolean;
  onResolved?: (response: string) => void;
  /** Avisa o hospedeiro quando um envio começa (true) e quando termina, com sucesso ou não (false). Opcional. */
  onSubmitting?: (inFlight: boolean) => void;
}

export const RESPONSE_MAX = 2000;
export const CONFLICT_MESSAGE = "A tarefa mudou. Confira antes de responder.";
export const ALREADY_ANSWERED_MESSAGE = "Já respondido";

/**
 * Resposta inline a um pedido de decisão do agente. [produto-telas RF8, RF10; design §7]
 * - cada opção é um botão que resolve com `response` = texto da opção; "Responder com texto" abre campo obrigatório (1–2000);
 * - uma trava síncrona + `isPending` impedem duplo envio; o `operationId` único vem do envelope retido em `useWorkflowWrite`
 *   (o mesmo envelope é reenviado após erro desconhecido, então a repetição é idempotente no servidor);
 * - `expectedVersion` é a versão do pedido; 409 recarrega o fluxo e avisa, sem reenviar sozinho;
 * - texto do usuário e do agente sempre como texto (RNF3).
 */
export function ActionResponse({ taskId, taskTitle, action, compact = false, onResolved, onSubmitting }: ActionResponseProps) {
  const write = useWorkflowWrite(taskId);
  const cache = useQueryClient();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const receipt = useRef<HTMLDivElement>(null);
  // O botão clicado some e vira o recibo: o foco vai para ele, senão cai no <body> (leitor de tela e teclado se perdem).
  useEffect(() => { if (done !== null) receipt.current?.focus(); }, [done]);

  async function explainConflict(): Promise<string> {
    // Recarrega o fluxo: se o pedido não está mais aberto, alguém já respondeu; senão a versão mudou.
    try {
      const snapshot = await cache.fetchQuery({
        queryKey: workflowKey(taskId),
        queryFn: async () => (await api.get<WorkflowSnapshot>(`/tasks/${encodeURIComponent(taskId)}/workflow`)).data,
        staleTime: 0,
      });
      const stillOpen = snapshot.actions.some(item => item.id === action.id && item.state === "OPEN");
      return stillOpen ? CONFLICT_MESSAGE : ALREADY_ANSWERED_MESSAGE;
    } catch {
      return CONFLICT_MESSAGE;
    }
  }

  async function send(raw: string) {
    const response = raw.trim();
    if (lock.current || !response || response.length > RESPONSE_MAX) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    onSubmitting?.(true);
    try {
      await write.mutateAsync({ kind: "resolve", actionId: action.id, values: { expectedVersion: action.version, response, resolution: "RESOLVED" } });
      setDone(response);
      setTyping(false);
      setText("");
      onResolved?.(response);
    } catch (error) {
      setNotice(httpStatus(error) === 409 ? await explainConflict() : workflowMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
      onSubmitting?.(false);
    }
  }

  if (done !== null) {
    return (
      <div ref={receipt} role="status" tabIndex={-1} className={cn("flex flex-col gap-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "items-end text-right max-md:items-start max-md:text-left" : "items-start")}>
        <span className="min-w-0 break-words"><b>Resposta registrada: {done}</b><br /><span className="text-muted">o agente vê ao retomar</span></span>
        <ResumePromptButton title={taskTitle} taskId={taskId} />
      </div>
    );
  }

  const size = compact ? "sm" : "default";
  const touch = "max-md:h-11 max-md:px-4";
  const options = action.options ?? [];
  return (
    <div data-busy={busy ? "" : undefined} className={cn("flex min-w-0 flex-col gap-2", compact ? "items-end max-md:items-start" : "items-start")}>
      {!typing && (
        <div role="group" aria-label="Responder ao pedido" className={cn("flex flex-wrap gap-1.5", compact && "justify-end max-md:justify-start")}>
          {options.map((option, index) => (
            <Button key={index} type="button" variant="outline" size={size} className={cn(touch, "max-w-full whitespace-normal")} disabled={busy} aria-busy={busy} onClick={() => void send(option)}>{option}</Button>
          ))}
          <Button type="button" variant="ghost" size={size} className={cn(touch, "text-muted")} disabled={busy} onClick={() => { setNotice(null); setTyping(true); }}>Responder com texto</Button>
        </div>
      )}
      {typing && (
        <form className="flex w-full min-w-0 flex-col gap-2" onSubmit={event => { event.preventDefault(); void send(text); }}>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold">Sua resposta</span>
            <Textarea autoFocus required maxLength={RESPONSE_MAX} rows={3} value={text} disabled={busy} className="w-full"
              onChange={event => setText(event.target.value)}
              onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); setTyping(false); } }} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size={size} className={touch} disabled={busy || !text.trim()} aria-busy={busy}>Enviar resposta</Button>
            <Button type="button" variant="ghost" size={size} className={touch} disabled={busy} onClick={() => { setTyping(false); setNotice(null); }}>Cancelar</Button>
            <span className="mono ml-auto text-[11px] text-muted" aria-hidden="true">{text.length}/{RESPONSE_MAX}</span>
          </div>
        </form>
      )}
      {notice && <p role="alert" className="max-w-prose break-words text-[13px] font-medium text-warning">{notice}</p>}
    </div>
  );
}
