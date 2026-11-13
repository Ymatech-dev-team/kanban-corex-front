"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/hooks/use-me";
import { useWorkflow, useWorkflowWrite, workflowMessage, type useMyWorkflowActions } from "@/lib/hooks/use-workflow";
import { httpStatus } from "@/lib/http-error";
import { REQUIRED_CHECKS, reviewRules } from "@/lib/review-rules";
import { ChecksStrip, SectionHeader, SignalTime, Stamp, StatusMark } from "@/components/live";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ActionResponse } from "./action-response";
import { isAccessDenied, type AgoraAction, type FeedItem } from "./agora-model";
import { BlockError } from "./block-error";
import { sheetHref, useOpenSheet } from "./open-sheet";

const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-1.5 border-b border-border py-3.5 max-md:grid-cols-1";
const VERB: Record<string, string> = { DECIDE: "pergunta", CLARIFY_SCOPE: "pede esclarecimento", UNBLOCK: "pede desbloqueio", REVIEW: "pede revisão humana" };
const REVIEW_REASON_MAX = 8000;
const GRACE_MS = 1500;

type Query = ReturnType<typeof useMyWorkflowActions>;

function RowMeta({ action, item, now, review = false }: { action: AgoraAction; item?: FeedItem; now: Date; review?: boolean }) {
  const who = item ? (item.state.execution?.channel === "MCP" && item.state.execution.agent ? item.state.execution.agent : item.responsibleName || "Agente") : "Agente";
  const place = [item?.clientName ?? action.clientName, item?.projectName ?? action.projectName].filter(Boolean).join(" › ");
  const title = item?.title ?? action.taskTitle ?? "Abrir tarefa";
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
      <StatusMark kind={review ? "review" : "you"} />
      <span>{who} {VERB[action.kind] ?? "pergunta"}</span>
      <span aria-hidden="true">·</span>
      <Link href={sheetHref(action.taskId)} scroll={false} className="font-semibold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:py-2">{title}</Link>
      {place && <><span aria-hidden="true">·</span><span>{place}</span></>}
      {action.createdAt && <><span aria-hidden="true">·</span><SignalTime iso={action.createdAt} now={now} className="text-xs" /></>}
    </div>
  );
}

/** Pedido de decisão do agente: pergunta inteira + botões de resposta inline (RF7, RF8). */
function AskRow({ action, item, now, onResolved, onSubmitting }: { action: AgoraAction; item?: FeedItem; now: Date; onResolved: (response: string) => void; onSubmitting: (inFlight: boolean) => void }) {
  const title = item?.title ?? action.taskTitle ?? "tarefa";
  return (
    <div className={ROW} data-action-id={action.id}>
      <div className="min-w-0">
        <RowMeta action={action} item={item} now={now} />
        <p className="my-0.5 mt-1 whitespace-pre-wrap break-words text-[15px] font-semibold">{action.question}</p>
      </div>
      <ActionResponse taskId={action.taskId} taskTitle={title} action={action} compact onResolved={onResolved} onSubmitting={onSubmitting} />
    </div>
  );
}

/** Revisão humana: 4 checks, achados abertos, Aprovar / Pedir ajuste / Abrir folha (RF9). */
function ReviewRow({ action, item, now, onResolved, onSubmitting }: { action: AgoraAction; item?: FeedItem; now: Date; onResolved: (summary: string) => void; onSubmitting: (inFlight: boolean) => void }) {
  const me = useMe();
  // Capacidades (canApprove, canReview…) só vêm do snapshot da tarefa; o estado do snapshot é o mais novo.
  const workflow = useWorkflow(action.taskId);
  const write = useWorkflowWrite(action.taskId);
  const open = useOpenSheet();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; tone: "ok" | "warn"; detail: string } | null>(null);
  const receipt = useRef<HTMLDivElement>(null);
  useEffect(() => { if (done) receipt.current?.focus(); }, [done]);

  // Sem acesso ao fluxo (401/403/404): nada do cache do snapshot, nem estado nem capacidades, e portanto sem botões de decisão.
  const noAccess = workflow.isError && isAccessDenied(workflow.error);
  const snapshot = noAccess ? undefined : workflow.data;
  const state = noAccess ? null : snapshot?.state ?? item?.state ?? null;
  const rules = reviewRules({ state, capabilities: snapshot?.capabilities, userId: me.data?.userId });
  const review = rules.review;
  const checks = REQUIRED_CHECKS.map(name => ({ name, status: review?.checks.find(check => check.name === name)?.status ?? ("pending" as const) }));
  const openFindings = state?.findings.filter(finding => finding.state === "open" || finding.state === "fix_reported") ?? [];

  async function decide(command: { type: "approve_review"; cycle: number } | { type: "request_changes"; cycle: number; reason: string }, result: { title: string; tone: "ok" | "warn"; detail: string }) {
    if (lock.current || !state) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    onSubmitting(true);
    try {
      await write.mutateAsync({ kind: "commands", command, expectedVersion: state.version });
      setDone(result);
      onResolved(`${result.title}${result.detail ? `: ${result.detail}` : ""}`);
    } catch (error) {
      setNotice(httpStatus(error) === 409 ? "A tarefa mudou. Confira antes de responder." : workflowMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
      onSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={ROW} data-action-id={action.id}>
        <div className="min-w-0"><RowMeta action={action} item={item} now={now} review /></div>
        <div ref={receipt} role="status" tabIndex={-1} className="flex flex-col items-end gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:items-start">
          <Stamp title={done.title} tone={done.tone}>{done.detail || "o agente vê ao retomar"}</Stamp>
        </div>
      </div>
    );
  }

  const heading = review ? `Entrega ${review.deliveryRevision} pronta para revisão` : action.question;
  const stillPending = !state || rules.reviewing;
  const size = "sm" as const;
  const touch = "max-md:h-11 max-md:px-4";
  return (
    <div className={ROW} data-action-id={action.id} data-busy={busy ? "" : undefined}>
      <div className="min-w-0">
        <RowMeta action={action} item={item} now={now} review />
        <p className="my-0.5 mt-1 break-words text-[15px] font-semibold">{heading}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {state ? <ChecksStrip checks={checks} /> : workflow.isLoading ? <Skeleton className="h-6 w-56" /> : null}
          <span className="text-xs text-muted">{!state ? "" : openFindings.length === 0 ? "nenhum achado aberto" : `${openFindings.length} ${openFindings.length === 1 ? "achado aberto" : "achados abertos"}`}</span>
        </div>
        {openFindings.length > 0 && (
          <ul className="m-0 mt-1 list-none p-0 text-[13px]">
            {openFindings.slice(0, 3).map(finding => (
              <li key={finding.id} className="break-words"><span className="mono text-[11px] text-muted">{finding.severity}{finding.blocking ? " · bloqueante" : ""}</span> {finding.description}</li>
            ))}
            {openFindings.length > 3 && <li className="text-xs text-muted">e mais {openFindings.length - 3} na folha</li>}
          </ul>
        )}
        {rules.showApprove && rules.approveBlocked && stillPending && <p className="mt-1 text-xs text-muted">Aprovar fica indisponível: algum check não passou ou há achado bloqueante aberto. Abra a folha para decidir.</p>}
        {noAccess && <p className="mt-1 text-xs text-muted">Não foi possível consultar o estado desta revisão. Abra a folha para ver o que está disponível para você.</p>}
        {state && !stillPending && <p className="mt-1 text-xs text-muted">Esta entrega não está mais aguardando revisão. Abra a folha para ver a decisão.</p>}
      </div>
      <div className="flex min-w-0 flex-col items-end gap-2 max-md:items-start">
        {!asking && (
          <div role="group" aria-label="Decidir revisão" className="flex flex-wrap justify-end gap-1.5 max-md:justify-start">
            {rules.showApprove && review && stillPending && (
              <Button type="button" size={size} className={touch} disabled={busy || rules.approveBlocked} aria-busy={busy}
                onClick={() => void decide({ type: "approve_review", cycle: review.cycle }, { title: "Aprovada", tone: "ok", detail: "a tarefa foi concluída" })}>Aprovar</Button>
            )}
            {rules.showRequestChanges && review && stillPending && (
              <Button type="button" variant="outline" size={size} className={touch} disabled={busy} onClick={() => { setNotice(null); setAsking(true); }}>Pedir ajuste</Button>
            )}
            <Button type="button" variant="ghost" size={size} className={cn(touch, "text-muted")} disabled={busy} onClick={() => open(action.taskId)}>Abrir folha</Button>
          </div>
        )}
        {asking && review && (
          <form className="flex w-full min-w-0 flex-col gap-2" onSubmit={event => { event.preventDefault(); const text = reason.trim(); if (text) void decide({ type: "request_changes", cycle: review.cycle, reason: text }, { title: "Ajustes pedidos", tone: "warn", detail: text }); }}>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold">Motivo do ajuste</span>
              <Textarea autoFocus required maxLength={REVIEW_REASON_MAX} rows={3} value={reason} disabled={busy} className="w-full"
                onChange={event => setReason(event.target.value)}
                onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); setAsking(false); } }} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size={size} className={touch} disabled={busy || !reason.trim()} aria-busy={busy}>Pedir ajuste</Button>
              <Button type="button" variant="ghost" size={size} className={touch} disabled={busy} onClick={() => { setAsking(false); setNotice(null); }}>Cancelar</Button>
            </div>
          </form>
        )}
        {notice && <p role="alert" className="max-w-prose break-words text-[13px] font-medium text-warning">{notice}</p>}
      </div>
    </div>
  );
}

/**
 * Esperando você (RF7): acima de tudo, com resposta inline.
 * Depois de responder, a invalidação do hook tira o pedido da lista antes de a promessa terminar; por isso a linha
 * respondida fica na tela (com a confirmação) e um pedido que some sem resposta nossa vira o aviso "Já respondido".
 */
export function WaitingForYou({ query, feedByTask, now }: { query: Query; feedByTask: Map<string, FeedItem>; now: Date }) {
  const fetched = useMemo(() => {
    const seen = new Set<string>();
    const all: AgoraAction[] = [];
    for (const page of query.data?.pages ?? []) for (const action of page.actions as AgoraAction[]) if (!seen.has(action.id)) { seen.add(action.id); all.push(action); }
    return all;
  }, [query.data]);

  const [known, setKnown] = useState<Record<string, AgoraAction>>({});
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [gone, setGone] = useState<Record<string, true>>({});
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  // Envio em voo: o servidor já tirou o pedido da lista (invalidação) mas a resposta só termina depois do último refetch.
  const [submitting, setSubmitting] = useState<Record<string, true>>({});

  useEffect(() => {
    setKnown(previous => {
      let changed = false;
      const next = { ...previous };
      for (const action of fetched) if (next[action.id] !== action) { next[action.id] = action; changed = true; }
      return changed ? next : previous;
    });
  }, [fetched]);

  const denied = query.isError && isAccessDenied(query.error);
  // Sem acesso, o que já vimos não pode reaparecer depois (nem virar "Já respondido" na recuperação).
  useEffect(() => { if (denied) { setKnown({}); setResolved({}); setGone({}); setSubmitting({}); } }, [denied]);

  const liveIds = useMemo(() => new Set(fetched.map(action => action.id)), [fetched]);
  const vanished = Object.keys(known).filter(id => !liveIds.has(id));
  const waiting = vanished.filter(id => !resolved[id] && !gone[id] && !submitting[id]).join("|");
  useEffect(() => {
    if (!waiting || !query.isSuccess) return;
    const ids = waiting.split("|");
    const timer = setTimeout(() => setGone(previous => ({ ...previous, ...Object.fromEntries(ids.map(id => [id, true as const])) })), GRACE_MS);
    return () => clearTimeout(timer);
  }, [waiting, query.isSuccess]);
  const onSubmitting = (id: string) => (inFlight: boolean) => setSubmitting(previous => {
    if (inFlight === !!previous[id]) return previous;
    const next = { ...previous };
    if (inFlight) next[id] = true; else delete next[id];
    return next;
  });

  const order = (a: AgoraAction, b: AgoraAction) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "") || b.id.localeCompare(a.id);
  const rows = [...fetched, ...vanished.filter(id => !gone[id] || resolved[id] || submitting[id]).map(id => known[id])].sort(order);
  const notices = vanished.filter(id => gone[id] && !resolved[id] && !submitting[id] && !dismissed[id]).map(id => known[id]);

  if (query.isLoading) {
    return (
      <section aria-labelledby="h-you" className="mt-9">
        <SectionHeader title="Esperando você" id="h-you" alert />
        <div role="status" aria-label="Carregando pedidos para você" className="space-y-3 py-3"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-8 w-48" /></div>
      </section>
    );
  }
  // Sem acesso: nada de cache (perguntas antigas, nem "nenhum pedido"), só o alerta.
  if (query.isError && (denied || fetched.length === 0)) {
    return (
      <section aria-labelledby="h-you" className="mt-9">
        <SectionHeader title="Esperando você" id="h-you" alert />
        <BlockError message="Não foi possível consultar os pedidos para você." onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </section>
    );
  }
  if (rows.length === 0 && notices.length === 0) return null;

  return (
    <section aria-labelledby="h-you" className="mt-9">
      <SectionHeader title="Esperando você" id="h-you" alert count={rows.filter(action => !resolved[action.id]).length} right={<span className="max-md:hidden">responda aqui mesmo, sem abrir a tarefa</span>} />
      {query.isError && <BlockError message="Não foi possível atualizar os pedidos. Mostrando o último estado carregado." onRetry={() => void query.refetch()} retrying={query.isFetching} />}
      {notices.map(action => (
        <div key={action.id} role="status" className="flex flex-wrap items-center gap-3 border-b border-border py-3 text-[13px]">
          <b>Já respondido</b>
          <span className="min-w-0 break-words text-muted">{action.taskTitle ?? "Pedido"} · alguém já respondeu ou o pedido foi encerrado.</span>
          <Button type="button" variant="ghost" size="sm" className="ml-auto max-md:h-11" onClick={() => setDismissed(previous => ({ ...previous, [action.id]: true }))}>Dispensar</Button>
        </div>
      ))}
      {rows.map(action => {
        const item = feedByTask.get(action.taskId);
        const onResolved = (summary: string) => setResolved(previous => ({ ...previous, [action.id]: summary }));
        return (
          <Fragment key={action.id}>
            {action.kind === "REVIEW"
              ? <ReviewRow action={action} item={item} now={now} onResolved={onResolved} onSubmitting={onSubmitting(action.id)} />
              : <AskRow action={action} item={item} now={now} onResolved={onResolved} onSubmitting={onSubmitting(action.id)} />}
          </Fragment>
        );
      })}
      {query.hasNextPage && <Button className="mt-3 max-md:h-11" variant="ghost" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Carregar mais pedidos</Button>}
    </section>
  );
}
