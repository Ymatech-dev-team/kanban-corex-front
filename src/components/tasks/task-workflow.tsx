"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { WorkflowCommand, WorkflowFinding } from "@sistema-tasks/contracts";
import { useWorkflowWrite, workflowMessage, type useWorkflow } from "@/lib/hooks/use-workflow";
import { useMe } from "@/lib/hooks/use-me";
import { workflowPresentation } from "@/lib/workflow-presentation";
import { reviewRules } from "@/lib/review-rules";

/**
 * Controlador do fluxo da tarefa: modos de formulário, mutações, travas e versão congelada do formulário.
 * A lógica é a de antes (o componente em abas), só que agora serve às seções da folha (`task-sheet/*`) por contexto:
 * Agora e Passos mostram o estado, Revisão e Agora oferecem as ações. Regras de habilitação vêm de `review-rules`.
 * Mutações, `expectedVersion`, ciclo congelado e `operationId` não mudaram. [RF30–RF32, RNF2]
 */
export type WorkflowMode = "init" | "submit" | "finding" | "changes" | "fix" | "waive" | "delivery";
export const modeTitles: Record<WorkflowMode, string> = { init: "Ativar fluxo nesta tarefa", submit: "Enviar para revisão", finding: "Registrar achado na mesma tarefa", changes: "Pedir ajuste", fix: "Informar correção", waive: "Dispensar achado", delivery: "Atualizar entrega" };
export const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
export type CheckStatus = "passed" | "failed" | "pending";

type Query = ReturnType<typeof useWorkflow>;

export interface WorkflowController {
  taskId: string;
  members: Record<string, string>;
  userId: string | undefined;
  query: Query;
  state: NonNullable<Query["data"]>["state"] | undefined;
  capabilities: NonNullable<Query["data"]>["capabilities"] | undefined;
  presentation: ReturnType<typeof workflowPresentation> | null;
  rules: ReturnType<typeof reviewRules>;
  busy: boolean;
  mode: WorkflowMode | null;
  error: string | null;
  notice: string;
  /** Onde mostrar erro e aviso: junto de onde a ação nasceu (Agora ou Revisão). */
  scope: "now" | "review";
  text: string; setText: Dispatch<SetStateAction<string>>;
  evidence: string; setEvidence: Dispatch<SetStateAction<string>>;
  context: string; setContext: Dispatch<SetStateAction<string>>;
  criteria: string; setCriteria: Dispatch<SetStateAction<string>>;
  responsible: string; setResponsible: Dispatch<SetStateAction<string>>;
  severity: WorkflowFinding["severity"]; setSeverity: Dispatch<SetStateAction<WorkflowFinding["severity"]>>;
  blocking: boolean; setBlocking: Dispatch<SetStateAction<boolean>>;
  checks: Record<string, CheckStatus>; setChecks: Dispatch<SetStateAction<Record<string, CheckStatus>>>;
  setActionDirty: (dirty: boolean) => void;
  open: (next: WorkflowMode, findingId?: string) => void;
  cancel: () => void;
  run: (command: WorkflowCommand, area?: "now" | "review") => Promise<void>;
  submit: (event: React.FormEvent) => Promise<void>;
}

const Ctx = createContext<WorkflowController | null>(null);
export function useWorkflowCtx(): WorkflowController {
  const value = useContext(Ctx);
  if (!value) throw new Error("useWorkflowCtx fora de WorkflowProvider");
  return value;
}

export function WorkflowProvider({ taskId, query, members, onDirtyChange, children }: {
  taskId: string; query: Query; members: Record<string, string>; onDirtyChange: (dirty: boolean) => void; children: ReactNode;
}) {
  const me = useMe();
  const write = useWorkflowWrite(taskId);
  const locked = useRef(false);
  const formBase = useRef<{ version: number; cycle?: number } | null>(null);
  const [actionDirty, setActionDirty] = useState(false);
  const [mode, setMode] = useState<WorkflowMode | null>(null);
  const [text, setText] = useState("");
  const [evidence, setEvidence] = useState("");
  const [context, setContext] = useState("");
  const [criteria, setCriteria] = useState("");
  const [responsible, setResponsible] = useState("");
  const [severity, setSeverity] = useState<WorkflowFinding["severity"]>("medium");
  const [blocking, setBlocking] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState("");
  const [checks, setChecks] = useState<Record<string, CheckStatus>>({ typecheck: "pending", lint: "pending", test: "pending", build: "pending" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [scope, setScope] = useState<"now" | "review">("review");
  useEffect(() => { onDirtyChange(mode !== null || actionDirty); return () => onDirtyChange(false); }, [mode, actionDirty, onDirtyChange]);
  const state = query.data?.state;
  const capabilities = query.data?.capabilities;
  const presentation = state ? workflowPresentation(state) : null;
  const rules = reviewRules({ state, capabilities, userId: me.data?.userId });
  const { review } = rules;
  const busy = write.isPending;

  function open(next: WorkflowMode, findingId = "") {
    if (mode !== null || locked.current) return;
    formBase.current = state ? { version: state.version, cycle: review?.cycle } : null;
    setScope(next === "init" || next === "delivery" ? "now" : "review");
    setMode(next); setSelectedFinding(findingId || crypto.randomUUID()); setText(""); setEvidence(""); setCriteria(""); setResponsible(state?.responsibleId ?? me.data?.userId ?? ""); setError(null); setNotice("");
    setContext(state?.context ?? "");
    if (next === "delivery") setCriteria(state?.criteria.join("\n") ?? "");
    setChecks({ typecheck: "pending", lint: "pending", test: "pending", build: "pending" });
  }
  async function run(command: WorkflowCommand, area?: "now" | "review") {
    if (!state || locked.current) return;
    if (area && !mode) setScope(area);
    locked.current = true; setError(null);
    try { await write.mutateAsync({ kind: "commands", command, expectedVersion: mode ? formBase.current!.version : state.version }); setMode(null); setNotice("Alteração registrada nesta tarefa."); }
    catch (cause) { setError(workflowMessage(cause)); }
    finally { locked.current = false; }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current || !mode) return;
    if (mode === "init") {
      locked.current = true; setError(null);
      try { await write.mutateAsync({ kind: "init", values: { responsibleId: responsible, context: text, criteria: lines(criteria) } }); setMode(null); setNotice("Fluxo ativado nesta tarefa."); }
      catch (cause) { setError(workflowMessage(cause)); }
      finally { locked.current = false; }
      return;
    }
    if (mode === "submit") await run({ type: "submit_review", summary: text, evidence: lines(evidence), checks: Object.entries(checks).map(([name, status]) => ({ name, status, required: true })), ...(state?.execution?.channel === "MCP" ? { reviewMode: "AGENT" as const } : { reviewerId: responsible }) });
    if (mode === "finding") await run({ type: "record_finding", id: selectedFinding, description: text, severity, criterion: criteria, responsibleId: responsible, blocking });
    if (mode === "changes" && formBase.current?.cycle) await run({ type: "request_changes", cycle: formBase.current!.cycle!, reason: text });
    if (mode === "fix") await run({ type: "report_fix", findingId: selectedFinding, evidence: lines(evidence) });
    if (mode === "waive" && formBase.current?.cycle) await run({ type: "waive_finding", findingId: selectedFinding, cycle: formBase.current!.cycle!, reason: text });
    if (mode === "delivery") await run({ type: "change_delivery", reason: text, context, criteria: lines(criteria) });
  }
  function cancel() { setMode(null); setError(null); }

  const value: WorkflowController = {
    taskId, members, userId: me.data?.userId, query, state, capabilities, presentation, rules, busy, mode, error, notice, scope,
    text, setText, evidence, setEvidence, context, setContext, criteria, setCriteria, responsible, setResponsible,
    severity, setSeverity, blocking, setBlocking, checks, setChecks, setActionDirty, open, cancel, run, submit,
  };
  // Sem memo de propósito: as funções fecham sobre o estado do formulário e só as seções da folha consomem este contexto.
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
