"use client";

import { useSyncExternalStore } from "react";
import type { DueState } from "@/lib/due";

/**
 * Notificações são derivadas de /tasks/mine (não há entidade no banco).
 * "Vista" é um estado local (localStorage), reativo e compartilhado entre o sino e o pop-up.
 * A identidade inclui o prazo e o estado: se a tarefa for remarcada ou passar de
 * "vence hoje" para "venceu", vira uma notificação nova e reaparece.
 */
const KEY = "sdt_seen_notifications";
const EMPTY: ReadonlySet<string> = new Set();

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
  if (cache) return cache;
  try {
    cache = new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    cache = new Set();
  }
  return cache;
}

function commit(next: Set<string>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* sem persistência — vale só nesta carga */
  }
  listeners.forEach((l) => l());
}

export function notifKey(taskId: string, dueDate: string | null, state: DueState): string {
  return `${taskId}|${dueDate ?? ""}|${state}`;
}

export function markSeen(keys: string[]) {
  if (keys.length === 0) return;
  const next = new Set(read());
  let changed = false;
  for (const k of keys) if (!next.has(k)) (next.add(k), (changed = true));
  if (changed) commit(next);
}

/** Mantém só as vistas ainda relevantes (tarefas ainda presentes), evitando crescer sem fim. */
export function pruneToTaskIds(taskIds: Set<string>) {
  const current = read();
  if (current.size === 0) return;
  const next = new Set([...current].filter((k) => taskIds.has(k.split("|")[0])));
  if (next.size !== current.size) commit(next);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Hook reativo: o conjunto de chaves de notificações já vistas. */
export function useSeenNotifications(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => read(),
    () => EMPTY,
  );
}
