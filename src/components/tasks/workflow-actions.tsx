"use client";
import { SimpleSelect } from "@/components/ui/select";
import { Fold } from "@/components/task-sheet/fold";

import { useEffect, useRef, useState } from "react";
import { useMe } from "@/lib/hooks/use-me";
import { useWorkflowWrite, workflowMessage, type WorkflowSnapshot } from "@/lib/hooks/use-workflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Pedido aberto para o usuário que a caixa de decisão da seção Agora responde (REVIEW é decidido em Revisão). */
export function isMyDecision(action: { kind: string; recipientId: string; state?: string }, userId: string | undefined): boolean {
  return !!userId && action.recipientId === userId && action.kind !== "REVIEW" && (action.state ?? "OPEN") === "OPEN";
}

/**
 * Pedidos abertos desta tarefa e "Solicitar ação". Responder ao próprio pedido acontece na caixa de decisão da
 * seção Agora (`ActionResponse`, com as mesmas regras de RF8–RF10); aqui ficam os pedidos dos outros e o formulário de novo pedido.
 */
export function WorkflowActions({ taskId, snapshot, members, onDirtyChange }: { taskId: string; snapshot: WorkflowSnapshot; members: Record<string, string>; onDirtyChange: (dirty: boolean) => void }) {
  const me = useMe();
  const write = useWorkflowWrite(taskId);
  const lock = useRef(false);
  const formVersion = useRef<number | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState("");
  const [kind, setKind] = useState<"CLARIFY_SCOPE" | "DECIDE" | "UNBLOCK">("DECIDE");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { onDirtyChange(active !== null); return () => onDirtyChange(false); }, [active, onDirtyChange]);
  function open() { formVersion.current = snapshot.state?.version ?? null; setActive("new"); setText(""); setError(null); setRecipient(""); setOptions(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!active || !snapshot.state || formVersion.current === null || lock.current) return;
    lock.current = true; setError(null);
    try {
      await write.mutateAsync({ kind: "actions", values: { expectedVersion: formVersion.current, recipientId: recipient, kind, question: text, options: options.split("\n").map((line) => line.trim()).filter(Boolean) } });
      setActive(null);
    } catch (cause) { setError(workflowMessage(cause)); }
    finally { lock.current = false; }
  }
  const visible = snapshot.actions.filter((action) => !isMyDecision(action, me.data?.userId));
  return <div className="space-y-3 border-t border-border pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Decisões e bloqueios</h3>{snapshot.capabilities.canWrite && snapshot.state?.stage !== "DONE" && !active && <Button size="sm" variant="ghost" className="max-md:min-h-11" onClick={open}>Solicitar ação</Button>}</div>
    {!snapshot.actions.length && <p className="text-xs text-muted">Nenhuma solicitação aberta nesta tarefa.</p>}
    {!!visible.length && <ul className="divide-y divide-border">{visible.map((action) => <li key={action.id} className="space-y-2 py-3"><p className="break-words text-sm">{action.kind === "REVIEW" ? "Revisão registrada nesta tarefa" : action.question.length > 280 ? "Decisão solicitada — consulte o contexto completo" : action.question}</p>{action.question.length > 280 || action.kind === "REVIEW" ? <Fold className="text-sm" title="Ver solicitação completa"><p className="whitespace-pre-wrap break-words">{action.question}</p></Fold> : null}<p className="text-xs text-muted">Para {members[action.recipientId] ?? "membro do projeto"}</p>{action.options?.length ? <ul className="list-inside list-disc text-xs text-muted">{action.options.map((option, index) => <li key={index}>{option}</li>)}</ul> : null}{action.kind === "REVIEW" && <p className="text-xs text-muted">Veja a seção Revisão para consultar o modo de revisão e o próximo passo.</p>}</li>)}</ul>}
    {active && <form onSubmit={submit} className="space-y-3 border border-border p-4"><h4 className="text-sm font-semibold">Solicitar uma decisão</h4><fieldset disabled={write.isPending} className="space-y-3"><SimpleSelect label="Tipo" value={kind} disabled={write.isPending} onValueChange={(value) => setKind(value as typeof kind)} options={[{value:"DECIDE",label:"Decisão"},{value:"CLARIFY_SCOPE",label:"Esclarecer escopo"},{value:"UNBLOCK",label:"Desbloquear execução"}]} /><SimpleSelect label="Destinatário" required value={recipient} disabled={write.isPending} placeholder="Selecione um membro" onValueChange={setRecipient} options={Object.entries(members).map(([value,label])=>({value,label}))} />
    <label className="block space-y-1 text-xs"><span>Pergunta e contexto</span><Textarea autoFocus required maxLength={8000} value={text} onChange={(event) => setText(event.target.value)} /></label><label className="block space-y-1 text-xs"><span>Opções, se houver — uma por linha</span><Textarea value={options} maxLength={8000} onChange={(event) => setOptions(event.target.value)} /></label></fieldset><div className="flex gap-2"><Button size="sm" type="submit" className="max-md:min-h-11" disabled={write.isPending} aria-busy={write.isPending}>Registrar</Button><Button size="sm" type="button" variant="ghost" className="max-md:min-h-11" disabled={write.isPending} onClick={() => setActive(null)}>Cancelar</Button></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>}
  </div>;
}
