"use client";

import { useEffect, useRef, useState } from "react";
import { useMe } from "@/lib/hooks/use-me";
import { useWorkflowWrite, workflowMessage, type WorkflowSnapshot } from "@/lib/hooks/use-workflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  function open(id: string) { formVersion.current = id === "new" ? snapshot.state?.version ?? null : snapshot.actions.find((item) => item.id === id)?.version ?? null; setActive(id); setText(""); setError(null); setRecipient(""); setOptions(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!active || !snapshot.state || formVersion.current === null || lock.current) return;
    lock.current = true; setError(null);
    try {
      if (active === "new") await write.mutateAsync({ kind: "actions", values: { expectedVersion: formVersion.current, recipientId: recipient, kind, question: text, options: options.split("\n").map((line) => line.trim()).filter(Boolean) } });
      else {
        const action = snapshot.actions.find((item) => item.id === active);
        if (!action) throw new Error("Solicitação mudou");
        await write.mutateAsync({ kind: "resolve", actionId: active, values: { expectedVersion: formVersion.current, response: text, resolution: "RESOLVED" } });
      }
      setActive(null);
    } catch (cause) { setError(workflowMessage(cause)); }
    finally { lock.current = false; }
  }
  return <div className="space-y-3 border-t border-border pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Decisões e bloqueios</h3>{snapshot.capabilities.canWrite && snapshot.state?.stage !== "DONE" && !active && <Button size="sm" variant="ghost" onClick={() => open("new")}>Solicitar ação</Button>}</div>
    {!snapshot.actions.length && <p className="text-xs text-muted-foreground">Nenhuma solicitação aberta nesta tarefa.</p>}
    <ul className="divide-y divide-border">{snapshot.actions.map((action) => <li key={action.id} className="space-y-2 py-3"><p className="break-words text-sm">{action.question}</p><p className="text-xs text-muted-foreground">Para {members[action.recipientId] ?? "membro do projeto"}</p>{action.options?.length ? <ul className="list-inside list-disc text-xs text-muted-foreground">{action.options.map((option, index) => <li key={index}>{option}</li>)}</ul> : null}{action.kind === "REVIEW" ? <p className="text-xs text-muted-foreground">Abra a aba Revisão para concluir esta solicitação.</p> : action.recipientId === me.data?.userId && <Button size="sm" variant="secondary" disabled={!!active} onClick={() => open(action.id)}>Responder</Button>}</li>)}</ul>
    {active && <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-4"><h4 className="text-sm font-medium">{active === "new" ? "Solicitar uma decisão" : "Responder à solicitação"}</h4><fieldset disabled={write.isPending} className="space-y-3">{active === "new" && <><label className="block text-xs">Tipo<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="mt-1 h-9 w-full rounded border border-input bg-background px-2"><option value="DECIDE">Decisão</option><option value="CLARIFY_SCOPE">Esclarecer escopo</option><option value="UNBLOCK">Desbloquear execução</option></select></label><label className="block text-xs">Destinatário<select required value={recipient} onChange={(event) => setRecipient(event.target.value)} className="mt-1 h-9 w-full rounded border border-input bg-background px-2"><option value="">Selecione um membro</option>{Object.entries(members).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></>}
    <label className="block space-y-1 text-xs"><span>{active === "new" ? "Pergunta e contexto" : "Sua resposta"}</span><Textarea autoFocus required maxLength={8000} value={text} onChange={(event) => setText(event.target.value)} /></label>{active === "new" && <label className="block space-y-1 text-xs"><span>Opções, se houver — uma por linha</span><Textarea value={options} maxLength={8000} onChange={(event) => setOptions(event.target.value)} /></label>}</fieldset><div className="flex gap-2"><Button size="sm" type="submit" disabled={write.isPending} aria-busy={write.isPending}>Registrar</Button><Button size="sm" type="button" variant="ghost" disabled={write.isPending} onClick={() => setActive(null)}>Cancelar</Button></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>}
  </div>;
}
