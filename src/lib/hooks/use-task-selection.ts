"use client";

import { useCallback, useState } from "react";

/**
 * Seleção múltipla de tarefas por id (ações em massa). Dona no ProjectBoard: sobrevive à troca
 * Kanban↔Lista e ao refetch (seleção por id, não por índice). Entrada explícita (botão "Selecionar"),
 * nunca long-press. A barra de ações só aparece com ≥1 selecionada. [acoes-em-massa]
 */
export function useTaskSelection() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const enter = useCallback(() => setSelectMode(true), []);
  const exit = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);
  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Seleciona um intervalo/grupo (Shift+clique, "selecionar todas/coluna") sem apagar o já marcado. */
  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  /** Desmarca um grupo (desfazer "selecionar coluna"). Não mexe no modo — o board decide sair se zerar. */
  const deselectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) if (next.delete(id)) changed = true;
      return changed ? next : prev;
    });
  }, []);

  /**
   * Poda a seleção pro conjunto ainda válido (visível pós-filtro / presente após refetch). Devolve o
   * MESMO Set quando nada muda → não dispara re-render em cadeia. Também serve pra "manter só as que
   * falharam" numa falha parcial. [RF-16/17/19]
   */
  const pruneTo = useCallback((valid: Set<string>) => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  return { selectMode, selectedIds, count: selectedIds.size, enter, exit, clear, toggle, selectMany, deselectMany, pruneTo };
}

export type TaskSelection = ReturnType<typeof useTaskSelection>;
