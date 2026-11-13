"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { WorkflowState } from "@sistema-tasks/contracts";
import { deriveLiveStatus, type LiveStatus } from "@/lib/live-status";
import { useMyWorkflowActions, useTeamWorkflows, useWorkflowMonitoring, type WorkflowAction } from "@/lib/hooks/use-workflow";
import { useNow } from "@/lib/hooks/use-now";
import { TaskCardExtrasProvider } from "@/components/board/task-card";

/** Qualquer item de feed (equipe ou /mine) com o estado do fluxo de uma tarefa. */
export interface LiveSource {
  taskId: string;
  updatedAt: string;
  state: WorkflowState;
  responsibleName?: string | null;
}

/** Primeiro pedido aberto para o usuário em cada tarefa (a pergunta vira o motivo de "Esperando você"). */
export function openActionsByTask(actions: WorkflowAction[]): Record<string, { kind: string; question: string }> {
  const out: Record<string, { kind: string; question: string }> = {};
  for (const action of actions) if (!out[action.taskId]) out[action.taskId] = { kind: action.kind, question: action.question };
  return out;
}

/** Estado vivo por tarefa: `deriveLiveStatus` para cada execução do feed, cruzando os pedidos abertos para o usuário. */
export function buildLiveByTask(items: LiveSource[], actions: WorkflowAction[], now: Date): Record<string, LiveStatus> {
  const open = openActionsByTask(actions);
  const out: Record<string, LiveStatus> = {};
  for (const item of items) {
    out[item.taskId] = deriveLiveStatus({ state: item.state, updatedAt: item.updatedAt, responsibleName: item.responsibleName, openActionForMe: open[item.taskId] ?? null }, now);
  }
  return out;
}

/** Pedidos abertos para o usuário (mesmo cache da Agora). */
export function useMyOpenActions(): WorkflowAction[] {
  const query = useMyWorkflowActions();
  return useMemo(() => query.data?.pages.flatMap((page) => page.actions) ?? [], [query.data]);
}

/** Lê o feed da equipe e entrega os itens a quem monta o provider (sem renderizar nada). */
function TeamFeed({ onItems }: { onItems: (items: LiveSource[]) => void }) {
  const feed = useTeamWorkflows();
  useEffect(() => onItems(feed.items), [feed.items, onItems]);
  return null;
}

/** Sem `tarefas.ver_globais`: o estado vivo vem de `/tasks/workflows/mine`. */
function MineFeed({ onItems }: { onItems: (items: LiveSource[]) => void }) {
  const feed = useWorkflowMonitoring();
  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  useEffect(() => onItems(items), [items, onItems]);
  return null;
}

/**
 * Entrega o estado vivo ao cartão, à lista e à tabela por contexto (o Kanban congelado não repassa props, RF26).
 * Sem `tarefas.ver_globais` o feed da equipe responde 403: a fonte passa a ser `/tasks/workflows/mine`.
 * As fontes são componentes irmãos, não pais: trocar de fonte não remonta os filhos (um quadro em arraste não perde estado).
 * Falha ou fluxo desligado: o mapa fica vazio e as telas seguem sem linha viva.
 */
export function LiveByTaskProvider({ canGlobal, engagementNameById, children }: { canGlobal: boolean; engagementNameById?: Record<string, string>; children: ReactNode }) {
  const [items, setItems] = useState<LiveSource[]>([]);
  const actions = useMyOpenActions();
  const now = useNow(30_000);
  const live = useMemo(() => buildLiveByTask(items, actions, now), [items, actions, now]);
  const value = useMemo(() => ({ live, now, engagementNameById }), [live, now, engagementNameById]);
  return (
    <TaskCardExtrasProvider value={value}>
      {canGlobal ? <TeamFeed key="team" onItems={setItems} /> : <MineFeed key="mine" onItems={setItems} />}
      {children}
    </TaskCardExtrasProvider>
  );
}
