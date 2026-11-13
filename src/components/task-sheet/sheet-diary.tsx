"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader, StatusMark } from "@/components/live";
import { CommentComposer, CommentItem, describeActivity, whenFull } from "@/components/board/activity-tab";
import { historyDetails, historyTitle } from "@/components/tasks/workflow-history";
import { useTaskActivity } from "@/lib/hooks/use-task-activity";
import { useWorkflowHistory } from "@/lib/hooks/use-workflow";
import { useNow } from "@/lib/hooks/use-now";
import { formatClock } from "@/lib/format-since";
import { CHANNEL_LABEL } from "./channel";
import { Fold } from "./fold";
import { dayKey, dayLabel, mergeDiary, type DiaryItem } from "./diary-model";
import { SHEET_SECTIONS } from "./sections";

export const DIARY_PAGE = 8;

/**
 * Diário (RF33): eventos do fluxo, atividade e comentários intercalados por horário, hora em mono, agrupado por dia.
 * Mostra os 8 mais recentes; "Ver tudo" busca o restante das duas fontes. Comentar fica no fim.
 */
export function SheetDiary({ taskId, membersById, managed }: { taskId: string; membersById: Record<string, string>; managed: boolean }) {
  const history = useWorkflowHistory(taskId, managed);
  const activity = useTaskActivity(taskId, true);
  const now = useNow(60_000);
  const [all, setAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nameOf = (id: string) => membersById[id] ?? "alguém sem acesso";

  const events = history.data?.pages.flatMap((page) => page.events);
  const entries = activity.data?.pages.flatMap((page) => page.items);
  const items = useMemo(() => mergeDiary(managed ? events ?? [] : [], entries ?? []), [managed, events, entries]);
  const historyMore = managed && !!history.hasNextPage;
  const activityMore = !!activity.hasNextPage;
  const hasMore = historyMore || activityMore;

  // "Ver tudo": busca, uma página por vez, o que falta das duas fontes.
  const { isFetchingNextPage: historyFetching, fetchNextPage: fetchHistory } = history;
  const { isFetchingNextPage: activityFetching, fetchNextPage: fetchActivity } = activity;
  useEffect(() => {
    if (!all) return;
    if (historyMore && !historyFetching) void fetchHistory();
    else if (activityMore && !activityFetching && !historyMore) void fetchActivity();
  }, [all, historyMore, activityMore, historyFetching, activityFetching, fetchHistory, fetchActivity]);

  const loading = (managed && history.isLoading) || activity.isLoading;
  const failed = (managed && history.isError) || activity.isError;
  const visible = all ? items : items.slice(0, DIARY_PAGE);
  const loadingRest = all && (hasMore || historyFetching || activityFetching);

  const groups: { key: string; label: string; items: DiaryItem[] }[] = [];
  for (const item of visible) {
    const key = dayKey(item.at);
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.at, now), items: [item] });
  }

  return (
    <section id={SHEET_SECTIONS.diary.id} aria-labelledby={`${SHEET_SECTIONS.diary.id}-title`} tabIndex={-1} className="scroll-mt-20 outline-none">
      <SectionHeader
        id={`${SHEET_SECTIONS.diary.id}-title`}
        title="Diário"
        right={!loading && items.length > 0 ? <span className="mono">{visible.length} de {items.length}{hasMore && !all ? "+" : ""} registros</span> : undefined}
      />
      {loading ? (
        <div role="status" aria-label="Carregando diário" className="space-y-2 py-2"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-5/6" /><Skeleton className="h-5 w-2/3" /></div>
      ) : (
        <>
          {failed && (
            <div role="alert" className="flex flex-wrap items-center gap-3 py-2 text-sm text-muted">
              Não foi possível carregar parte do diário.
              <Button size="sm" variant="ghost" className="max-md:min-h-11" onClick={() => { if (managed && history.isError) void history.refetch(); if (activity.isError) void activity.refetch(); }}>Tentar de novo</Button>
            </div>
          )}
          {items.length === 0 && !failed && <p className="py-3 text-sm text-muted">Sem registros ainda. Comente abaixo.</p>}
          {/* Alvo de foco estável: "Ver tudo" some depois do clique e o foco não pode cair no corpo da página. */}
          <div ref={listRef} tabIndex={-1} className="outline-none">
          {groups.map((group) => (
            <div key={group.key} role="group" aria-label={group.label}>
              <h3 className="mt-3 border-b border-foreground pb-1 text-xs font-bold">{group.label}</h3>
              <ol className="m-0 list-none p-0">
                {group.items.map((item) => (
                  <li key={item.key} className="grid grid-cols-[48px_14px_minmax(0,1fr)] gap-x-2.5 border-b border-border py-2 text-[13px] md:grid-cols-[52px_14px_minmax(0,1fr)]">
                    <time dateTime={item.at} title={whenFull(item.at)} className="mono pt-px text-xs text-muted">{formatClock(item.at)}</time>
                    <span className="pt-1"><StatusMark kind={item.kind} /></span>
                    <div className="min-w-0">
                      {item.source === "flow" ? (
                        <>
                          <p className="break-words"><span>{historyTitle(item.event)}</span> <span className="text-muted">· {membersById[item.event.actorId] ?? "Membro do projeto"} · {CHANNEL_LABEL[item.event.channel as keyof typeof CHANNEL_LABEL] ?? "Canal não informado"} · entrega {item.event.deliveryRevision}</span></p>
                          {historyDetails(item.event.payload ?? {}).length > 0 && (
                            <Fold title="Ver registro completo" className="mt-1">
                              <div className="flex flex-col gap-2">{historyDetails(item.event.payload ?? {}).map((text, index) => <p key={index} className="whitespace-pre-wrap break-words text-sm">{text}</p>)}</div>
                            </Fold>
                          )}
                        </>
                      ) : item.activity.type === "COMMENT" ? (
                        <CommentItem activity={item.activity} taskId={taskId} variant="diary" />
                      ) : (
                        <p className="break-words">{describeActivity(item.activity, nameOf)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          </div>
          {!all && (items.length > DIARY_PAGE || hasMore) && (
            <Button variant="ghost" size="sm" className="mt-2 pl-0 max-md:min-h-11" onClick={() => { listRef.current?.focus({ preventScroll: true }); setAll(true); }}>Ver tudo</Button>
          )}
          {loadingRest && <p role="status" className="mt-2 text-xs text-muted">Carregando o restante…</p>}
        </>
      )}
      <CommentComposer taskId={taskId} className="mt-4 border-t border-border pt-3" />
    </section>
  );
}
