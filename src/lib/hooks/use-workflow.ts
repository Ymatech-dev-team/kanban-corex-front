import { useRef } from "react";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { WorkflowState, WorkflowCommand, InitializeWorkflowInput } from "@sistema-tasks/contracts";
import { api } from "@/lib/api";

export interface WorkflowAction {
  id: string;
  taskId: string;
  orgId: string;
  recipientId: string;
  kind: string;
  state: string;
  question: string;
  version: number;
  options?: string[];
  response?: string | null;
}
export interface WorkflowSnapshot {
  state: WorkflowState | null;
  events: unknown[];
  actions: WorkflowAction[];
  capabilities: { canWrite: boolean; canReview: boolean; canApprove: boolean; canReopen: boolean };
}
export const workflowKey = (taskId: string) => ["workflow", taskId] as const;
export const myActionsKey = ["workflow-actions", "mine"] as const;

export function useWorkflow(taskId: string) {
  return useQuery({
    queryKey: workflowKey(taskId),
    queryFn: async () => (await api.get<WorkflowSnapshot>(`/tasks/${encodeURIComponent(taskId)}/workflow`)).data,
    enabled: !!taskId,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
export function useMyWorkflowActions() {
  return useInfiniteQuery({
    queryKey: myActionsKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => (await api.get<{ actions: WorkflowAction[]; nextCursor: string | null }>("/tasks/actions/mine", { params: { limit: 30, ...(pageParam ? { cursor: pageParam } : {}) } })).data,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function workflowMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 400) {
    const message = (error as { response?: { data?: { error?: { message?: unknown } } } })?.response?.data?.error?.message;
    if (typeof message === "string" && message.trim()) return message.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500);
  }
  if (status === 409) return "A tarefa mudou. Seu formulário mantém a versão original. Cancele e reabra para trabalhar sobre a versão atual.";
  if (status === 403 || status === 401) return "Você não tem autorização para esta ação. Atualize a tarefa para verificar seu acesso.";
  return "Não foi possível confirmar a alteração. Seu texto foi preservado; tente novamente.";
}

/** Retain the envelope after an unknown result so retry cannot duplicate a command. */
export function useWorkflowWrite(taskId: string) {
  const cache = useQueryClient();
  const envelope = useRef<{ fingerprint: string; path: string; body: object } | null>(null);
  return useMutation({
    retry: false,
    mutationFn: async (input: { kind: "actions"; values: { expectedVersion: number; recipientId: string; kind: "CLARIFY_SCOPE" | "DECIDE" | "UNBLOCK"; question: string; options: string[] } } | { kind: "resolve"; actionId: string; values: { expectedVersion: number; response: string; resolution: "RESOLVED" | "CANCELLED" } } | { kind: "init"; values: Omit<InitializeWorkflowInput, "operationId"> } | { kind: "commands"; command: WorkflowCommand; expectedVersion: number }) => {
      const fingerprint = taskId + ":" + JSON.stringify(input.kind === "commands" ? { kind: input.kind, command: input.command } : input.kind === "init" ? input : { ...input, values: { ...input.values, expectedVersion: undefined } });
      if (!envelope.current || envelope.current.fingerprint !== fingerprint) {
        envelope.current = { fingerprint, path: `/tasks/${encodeURIComponent(taskId)}/workflow/${input.kind === "resolve" ? `actions/${encodeURIComponent(input.actionId)}/resolve` : input.kind}`, body: { operationId: crypto.randomUUID(), ...(input.kind === "commands" ? { expectedVersion: input.expectedVersion, command: input.command } : input.values) } };
      }
      try {
        const result = await api.post<{ state: WorkflowState }>(envelope.current.path, envelope.current.body);
        envelope.current = null;
        return result.data.state;
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) envelope.current = null;
        throw error;
      }
    },
    onSettled: async () => {
      await Promise.all([cache.invalidateQueries({ queryKey: workflowKey(taskId) }), cache.invalidateQueries({ queryKey: myActionsKey }), cache.invalidateQueries({ queryKey: ["task", taskId] }), cache.invalidateQueries({ queryKey: ["tasks"] }), cache.invalidateQueries({ queryKey: ["eng-tasks"] })]);
    },
  });
}

export interface WorkflowHistoryEvent {
  id: string;
  actorId: string;
  channel: string;
  type: string;
  version: number;
  deliveryRevision: number;
  createdAt: string;
  payload: Record<string, unknown>;
}
export function useWorkflowHistory(taskId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...workflowKey(taskId), "history"],
    enabled,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => (await api.get<{ events: WorkflowHistoryEvent[]; nextEventCursor: number | null }>(`/tasks/${encodeURIComponent(taskId)}/workflow`, { params: { limit: 20, ...(pageParam !== undefined ? { beforeVersion: pageParam } : {}) } })).data,
    getNextPageParam: (page) => page.nextEventCursor ?? undefined,
  });
}
