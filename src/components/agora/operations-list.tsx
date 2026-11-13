"use client";

import Link from "next/link";
import { SignalTime, StatusMark } from "@/components/live";
import { nowText, type RowGroup } from "./agora-model";
import { sheetHref } from "./open-sheet";

/**
 * Em andamento abaixo de 768 px (RF18): cada execução em 3 níveis, sem rolagem horizontal.
 * 1) estado · quem · tempo  2) título  3) fazendo-agora. Tocar abre a folha em tela cheia.
 */
export function OperationsList({ groups, now }: { groups: RowGroup[]; now: Date }) {
  return (
    <div>
      {groups.map(group => (
        <section key={group.key} aria-label={group.label}>
          <h3 className="mb-0 mt-4 border-b border-foreground pb-1.5 text-[13px] font-bold">{group.label}<span className="mono ml-1.5 font-normal text-muted">{group.rows.length}</span></h3>
          <ul className="m-0 list-none p-0">
            {group.rows.map(({ item, live }) => {
              const alert = live.kind === "silent" || live.kind === "blocked";
              return (
                <li key={item.taskId} data-row="" data-task-id={item.taskId}>
                  <Link href={sheetHref(item.taskId)} scroll={false} className="block min-h-11 border-b border-border py-3 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <StatusMark kind={live.kind} label={live.label} />
                      <span aria-hidden="true" className="font-normal text-muted">·</span>
                      <span className="min-w-0 truncate">{live.who}</span>
                      <SignalTime iso={live.lastSignalAt} now={now} alert={alert} className="ml-auto text-xs font-normal" />
                    </span>
                    <span className="mt-1 block break-words font-semibold">{item.title}</span>
                    <span className="mt-0.5 block break-words text-[13px] text-muted">
                      {nowText(live)}
                      {live.steps && live.steps.total > 0 && <span className="mono"> · {live.steps.done} de {live.steps.total}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
