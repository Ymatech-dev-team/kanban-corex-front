"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/** Rota da folha: a rota interceptada `@task` abre o drawer; em acesso direto vira a página. `from=/` volta para a Agora. */
export const sheetHref = (taskId: string) => `/tarefas/${encodeURIComponent(taskId)}?from=%2F`;

export function useOpenSheet() {
  const router = useRouter();
  return useCallback((taskId: string) => router.push(sheetHref(taskId), { scroll: false }), [router]);
}
