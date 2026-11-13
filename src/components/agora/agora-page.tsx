"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { useCan } from "@/lib/hooks/use-can";
import { useMe } from "@/lib/hooks/use-me";
import { useNow } from "@/lib/hooks/use-now";
import { TEAM_FEED_LIMIT, useMyWorkflowActions, useTeamWorkflows, useWorkflowMonitoring } from "@/lib/hooks/use-workflow";
import {
  buildDoneToday, buildRows, countRows, isAccessDenied, parseGroup, parseView,
  type AgoraAction, type FeedItem, type GroupBy, type ViewFilter,
} from "./agora-model";
import { DeadlinesBlock } from "./deadlines-block";
import { DoneToday } from "./done-today";
import { OperationsBlock } from "./operations-block";
import { SituationLine } from "./situation-line";
import { WaitingForYou } from "./waiting-for-you";

/** O que a Agora precisa do feed, venha ele de `/team` (com `tarefas.ver_globais`) ou de `/mine`. */
interface AgoraFeed {
  items: FeedItem[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
  truncated: boolean;
  updatedAt: number;
}
const PENDING_FEED: AgoraFeed = { items: [], isLoading: true, isError: false, error: null, isFetching: false, refetch: () => undefined, truncated: false, updatedAt: 0 };

function TeamAgora() {
  const query = useTeamWorkflows();
  const feed: AgoraFeed = { items: query.items, isLoading: query.isLoading, isError: query.isError, error: query.error, isFetching: query.isFetching, refetch: query.refetch, truncated: query.truncated, updatedAt: query.dataUpdatedAt };
  return <AgoraBody feed={feed} canGlobal />;
}

/** Sem `tarefas.ver_globais`: o feed é o `/mine` (comportamento anterior), sem agrupar por pessoa. */
function MineAgora() {
  const query = useWorkflowMonitoring();
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  const items = useMemo(() => {
    const byTask = new Map<string, FeedItem>();
    for (const page of query.data?.pages ?? []) for (const item of page.items) {
      const existing = byTask.get(item.taskId);
      // Uma tarefa pode mudar de página durante o polling: nunca trocar um estado novo por um antigo.
      if (!existing || item.state.version > existing.state.version) byTask.set(item.taskId, item);
    }
    return [...byTask.values()].slice(0, TEAM_FEED_LIMIT);
  }, [query.data]);
  const loaded = query.data?.pages.reduce((n, page) => n + page.items.length, 0) ?? 0;
  const pageCount = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError && loaded < TEAM_FEED_LIMIT) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, loaded, pageCount, fetchNextPage]);
  const feed: AgoraFeed = { items, isLoading: query.isLoading, isError: query.isError, error: query.error, isFetching: query.isFetching, refetch: query.refetch, truncated: !!hasNextPage && loaded >= TEAM_FEED_LIMIT, updatedAt: query.dataUpdatedAt };
  return <AgoraBody feed={feed} canGlobal={false} />;
}

function AgoraBody({ feed, canGlobal }: { feed: AgoraFeed; canGlobal: boolean }) {
  const now = useNow(30_000);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const view = parseView(search.get("ver"));
  const requested = parseGroup(search.get("agrupar"));
  const group: GroupBy = requested === "pessoa" && !canGlobal ? "estado" : requested;
  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value); else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // 401/403/404: o cache da consulta não pode aparecer (nem como contagem); erro de rede/5xx mantém o último estado.
  const feedDenied = feed.isError && isAccessDenied(feed.error);
  const actionsQuery = useMyWorkflowActions();
  const actionsDenied = actionsQuery.isError && isAccessDenied(actionsQuery.error);
  const actions = useMemo(() => {
    if (actionsDenied) return [];
    const seen = new Set<string>();
    const all: AgoraAction[] = [];
    for (const page of actionsQuery.data?.pages ?? []) for (const action of page.actions as AgoraAction[]) if (!seen.has(action.id)) { seen.add(action.id); all.push(action); }
    return all;
  }, [actionsQuery.data, actionsDenied]);
  const items = useMemo(() => (feedDenied ? [] : feed.items), [feedDenied, feed.items]);
  const feedByTask = useMemo(() => new Map(items.map(item => [item.taskId, item])), [items]);

  const rows = useMemo(() => buildRows(items, actions, now), [items, actions, now]);
  const done = useMemo(() => buildDoneToday(items, now), [items, now]);
  const counts = useMemo(() => countRows(rows, actions, done), [rows, actions, done]);

  const feedFailed = feed.isError && (feedDenied || feed.items.length === 0);
  return (
    <>
      <SituationLine now={now} counts={feedFailed ? null : counts} loading={feed.isLoading || actionsQuery.isLoading} view={view}
        onView={next => setParam("ver", view === next ? null : (next satisfies ViewFilter))} />
      <WaitingForYou query={actionsQuery} feedByTask={feedByTask} now={now} />
      <OperationsBlock rows={rows} now={now} group={group} onGroup={next => setParam("agrupar", next === "estado" ? null : next)} canGroupByPerson={canGlobal}
        view={view} onClearView={() => setParam("ver", null)}
        loading={feed.isLoading} error={feed.isError} denied={feedDenied} retrying={feed.isFetching} onRetry={() => void feed.refetch()} truncated={feed.truncated}
        updatedAt={Math.max(feed.updatedAt, actionsQuery.dataUpdatedAt)} createHref={canGlobal ? "/tarefas" : "/clientes"} />
      <div className="grid gap-x-10 md:grid-cols-2">
        {canGlobal && <DeadlinesBlock now={now} />}
        <DoneToday rows={done} />
      </div>
    </>
  );
}

/** Agora (`/`): o que está rodando, o que parou e o que espera você. [produto-telas F1, RF6–RF18] */
export function AgoraPage() {
  const me = useMe();
  const canGlobal = useCan(PERMISSIONS.tarefas_ver_globais);
  useEffect(() => {
    const previous = document.title;
    document.title = "Agora · Corex Tasks";
    return () => { document.title = previous; };
  }, []);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 lg:px-10 lg:pt-7">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-.02em] max-md:text-2xl">Agora</h1>
        {/* Espera a sessão para decidir a fonte do feed (/team ou /mine) sem chamar a errada. */}
        {me.isPending ? <AgoraBody feed={PENDING_FEED} canGlobal={false} /> : canGlobal ? <TeamAgora /> : <MineAgora />}
      </div>
    </div>
  );
}
