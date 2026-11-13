"use client";

import Link from "next/link";
import { SectionHeader } from "@/components/live";
import { formatClock } from "@/lib/format-since";
import { type DoneRow } from "./agora-model";
import { sheetHref } from "./open-sheet";

/** Feito hoje (RF15): concluídas desde 00:00 BRT; some se vazio. */
export function DoneToday({ rows }: { rows: DoneRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="h-feito" className="mt-9">
      <SectionHeader title="Feito hoje" id="h-feito" count={rows.length} />
      <dl className="m-0 grid grid-cols-[62px_minmax(0,1fr)] gap-x-3.5 gap-y-1 text-[13px]">
        {rows.map(({ item, live, verb }) => (
          <div key={item.taskId} className="contents">
            <dt className="mono py-0.5 text-xs text-muted">{formatClock(item.updatedAt)}</dt>
            <dd className="m-0 min-w-0 break-words py-0.5">
              {live.who} {verb}{" "}
              <Link href={sheetHref(item.taskId)} scroll={false} className="font-bold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:inline-block max-md:py-2">{item.title}</Link>
              {item.clientName && <span className="text-muted"> · {item.clientName}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
