"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PERMISSIONS, type TaskStatus } from "@sistema-tasks/contracts";
import type { Task } from "@/lib/types";
import { useCan } from "@/lib/hooks/use-can";
import { useTaskSelection } from "@/lib/hooks/use-task-selection";
import { useBulkDeleteTasks, useBulkMove, useRestoreTask } from "@/lib/hooks/use-tasks";
import { undoToast } from "@/lib/undo-toast";

/**
 * Seleção múltipla + ações em massa do board, extraída do ProjectBoard (T8). Comportamento idêntico —
 * a lógica de RF-3/9/14/17/18/19 e os handlers de bulk delete/move moram aqui; o board só renderiza.
 * A seleção é dona aqui (via useTaskSelection) → sobrevive a Kanban↔Lista e ao refetch. [acoes-em-massa]
 */
export function useBoardSelection(opts: {
  clientId: string;
  engagementId: string;
  effectiveView: string;
  allTasks: Task[];
  visibleTasks: Task[];
}) {
  const { clientId, engagementId, effectiveView, allTasks, visibleTasks } = opts;

  const canDelete = useCan(PERMISSIONS.tarefas_excluir);
  const canMove = useCan(PERMISSIONS.tarefas_mover);
  const selection = useTaskSelection();
  const { selectMode, selectedIds, count, enter, exit, toggle, selectMany, deselectMany, pruneTo } = selection;
  const bulkDelete = useBulkDeleteTasks(clientId, engagementId);
  const bulkMove = useBulkMove(clientId, engagementId);
  const restoreTask = useRestoreTask(clientId);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const busy = bulkDelete.isPending || bulkMove.isPending; // bloqueia sair no meio do envio (não perde a re-seleção de falha)
  const selectBtnRef = useRef<HTMLButtonElement>(null); // foco volta pra cá ao sair do modo [a11y]
  const wasSelectingRef = useRef(false);

  // Poda a seleção pro que continua visível (filtro/refetch); encerra ao trocar contexto ou sair de
  // Kanban/Lista; Esc sai do modo. [RF-3/17/18/19]
  useEffect(() => {
    pruneTo(new Set(visibleTasks.map((t) => t.id)));
  }, [visibleTasks, pruneTo]);
  useEffect(() => {
    exit();
  }, [clientId, engagementId, exit]);
  useEffect(() => {
    if (effectiveView !== "kanban" && effectiveView !== "lista") exit();
  }, [effectiveView, exit]);
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmBulk && !busy) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode, confirmBulk, busy, exit]);
  // ao SAIR do modo, devolve o foco pro botão "Selecionar" (não deixa cair no body). [a11y RF-4]
  useEffect(() => {
    if (wasSelectingRef.current && !selectMode) selectBtnRef.current?.focus();
    wasSelectingRef.current = selectMode;
  }, [selectMode]);

  const canSelect =
    (canDelete || canMove) && (effectiveView === "kanban" || effectiveView === "lista") && allTasks.length > 0;

  // desmarcar a última sai do modo (RF-3); no envio, ignora pra não perder a re-seleção de falha.
  const handleToggle = (id: string) => {
    if (busy) return;
    if (selectedIds.size === 1 && selectedIds.has(id)) exit();
    else toggle(id);
  };
  const enterOrExit = () => {
    if (busy) return;
    if (selectMode) exit();
    else enter();
  };
  // "selecionar todas as visíveis" (checkbox-mestre da Lista). Tudo marcado → limpa e sai. [RF-9]
  const visibleIds = useMemo(() => visibleTasks.map((t) => t.id), [visibleTasks]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const toggleAllVisible = () => {
    if (busy) return;
    if (allVisibleSelected) exit();
    else selectMany(visibleIds);
  };
  // "selecionar coluna" (Kanban). Coluna toda marcada → desmarca; se zerar tudo, sai. [RF-9]
  const toggleColumn = (status: TaskStatus) => {
    if (busy) return;
    const colIds = visibleTasks.filter((t) => t.status === status).map((t) => t.id);
    if (colIds.length === 0) return;
    const allSel = colIds.every((id) => selectedIds.has(id));
    if (allSel) {
      const rest = [...selectedIds].filter((id) => !colIds.includes(id));
      if (rest.length === 0) exit();
      else deselectMany(colIds);
    } else selectMany(colIds);
  };

  const doBulkDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    bulkDelete.mutate(
      { ids },
      {
        onSuccess: (res) => {
          setConfirmBulk(false);
          const failed = ids.filter((id) => !res.deletedIds.includes(id));
          const n = res.deletedCount;
          undoToast(`${n} ${n === 1 ? "tarefa excluída" : "tarefas excluídas"}`, () => {
            if (res.deletedIds[0]) restoreTask.mutate({ id: res.deletedIds[0], engagementId, count: n });
          });
          if (failed.length > 0) {
            // best-effort: as que sobraram foram removidas/alteradas por outra pessoa nesse meio-tempo. [RF-14]
            toast.message(
              `${failed.length} ${failed.length === 1 ? "não pôde" : "não puderam"} ser excluída${failed.length === 1 ? "" : "s"} — recarregue e tente de novo.`,
            );
            pruneTo(new Set(failed)); // mantém só as que falharam
          } else {
            exit();
          }
        },
      },
    );
  };

  const doBulkMove = (status: TaskStatus) => {
    const selected = allTasks.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) return;
    // posições no fim da coluna destino (base = maior posição entre as NÃO selecionadas de lá). [design]
    const base = allTasks
      .filter((t) => t.status === status && !selectedIds.has(t.id))
      .reduce((mx, t) => Math.max(mx, t.position), 0);
    const moves = selected.map((t, i) => ({ id: t.id, status, position: base + i + 1 }));
    bulkMove.mutate(
      { moves },
      {
        onSuccess: (res) => {
          if (res.failedIds.length === 0) {
            toast.success(`${res.total} ${res.total === 1 ? "tarefa movida" : "tarefas movidas"}`);
            exit();
          } else {
            const ok = res.total - res.failedIds.length;
            toast.message(
              `${ok} de ${res.total} movidas · ${res.failedIds.length} ${res.failedIds.length === 1 ? "falhou" : "falharam"}`,
            );
            pruneTo(new Set(res.failedIds)); // mantém só as que falharam pra tentar de novo
          }
        },
      },
    );
  };

  return {
    selectMode,
    count,
    canSelect,
    canDelete,
    canMove,
    busy, // delete OU move em voo (bloqueia sair) — usado pela barra de ações
    deleting: bulkDelete.isPending, // só o delete — usado pelo ConfirmDialog
    selectBtnRef,
    isSelected: (id: string) => selectedIds.has(id),
    selectMany, // Shift+range da Lista (onSelectRange)
    allVisibleSelected,
    enterOrExit,
    exit,
    handleToggle,
    toggleAllVisible,
    toggleColumn,
    confirmBulk,
    setConfirmBulk,
    doBulkDelete,
    doBulkMove,
  };
}
