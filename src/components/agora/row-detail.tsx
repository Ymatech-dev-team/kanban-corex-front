"use client";

import { ResumePromptButton } from "@/components/live";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { lastDone, type AgoraRow } from "./agora-model";

const H = "mb-1.5 mt-0 text-[11px] font-semibold uppercase tracking-[.06em] text-muted";

/** Expansão inline de uma execução (RF13): objetivo, últimos feitos, próximo passo, motivo de parada e ações. */
export function RowDetail({ row, onOpen, stacked = false }: { row: AgoraRow; onOpen: (taskId: string) => void; stacked?: boolean }) {
  const { item, live } = row;
  const summary = item.state.summary;
  const done = lastDone(item.state);
  const alert = live.kind === "silent" || live.kind === "blocked";
  return (
    <div className={cn("grid gap-x-7 gap-y-4 border-t border-dashed border-border pt-3.5", stacked ? "grid-cols-1" : "grid-cols-[1.2fr_1fr_1fr]")}>
      <div className="min-w-0">
        <h4 className={H}>Objetivo</h4>
        <p className="m-0 mb-2.5 break-words">{summary?.objective ?? "O agente ainda não relatou passos."}</p>
        {live.reason && <>
          <h4 className={H}>Por que parou</h4>
          <p className={cn("m-0 break-words", alert && "font-semibold text-danger")}>{live.reason}</p>
        </>}
      </div>
      <div className="min-w-0">
        <h4 className={H}>Últimos feitos</h4>
        {done.length === 0 && !live.next ? <p className="m-0 text-muted">Nenhum passo concluído ainda.</p> : (
          <ul className="m-0 list-none p-0">
            {done.map((step, index) => (
              <li key={index} className="flex items-baseline gap-2 py-0.5 text-muted line-through decoration-accent decoration-2">
                <span aria-hidden="true" className="mt-0.5 inline-block size-[9px] shrink-0 border-[1.5px] border-accent bg-accent" />
                <span className="min-w-0 break-words">{step}</span>
              </li>
            ))}
            {live.next && (
              <li className="flex items-baseline gap-2 py-0.5 font-bold">
                <span aria-hidden="true" className="mt-0.5 inline-block size-[9px] shrink-0 border-[1.5px] border-foreground" />
                <span className="min-w-0 break-words">{live.next}<em className="mono ml-1.5 text-[11px] font-medium not-italic text-success">próximo</em></span>
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="min-w-0">
        <h4 className={H}>Ações</h4>
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" size="sm" className="max-md:h-11" onClick={() => onOpen(item.taskId)}>Abrir folha</Button>
          {(live.kind === "silent" || live.kind === "paused") && <ResumePromptButton title={item.title} taskId={item.taskId} />}
        </div>
      </div>
    </div>
  );
}
