"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useTaskDetail } from "@/lib/hooks/use-tasks";
import { useBoardNav } from "@/lib/board-nav";
import { BoardSkeleton, BoardError, EmptyClients } from "@/components/board/board-states";

/**
 * /tarefas deixou de ser o quadro — o quadro agora vive por projeto em
 * /clientes/[id]/projetos/[engagementId]. Esta página RESOLVE o contexto
 * (cliente → projeto, ou a tarefa da ponte board-nav) e redireciona. [B2 / RF-61/66]
 */
export default function TarefasResolver() {
  const router = useRouter();
  const nav = useBoardNav();
  const projects = useProjects();
  const done = useRef(false);

  const pending = nav.pending;
  const taskId = pending?.taskId ?? null;
  // Deep-link de tarefa: descobre o projeto pela própria tarefa. [RF-66]
  const taskDetail = useTaskDetail(taskId);

  // Cliente-alvo: da tarefa (quando houver), ou da ponte, ou o primeiro acessível.
  const targetClient =
    taskDetail.data?.projectId ?? pending?.projectId ?? projects.data?.[0]?.id ?? null;
  // Só busca engagements quando não estamos resolvendo por tarefa.
  const engagements = useEngagements(taskId ? null : targetClient);

  useEffect(() => {
    if (done.current) return;

    // 1) Ponte trouxe uma tarefa → resolve o projeto dela e abre a tarefa.
    if (taskId) {
      const t = taskDetail.data;
      if (t?.projectId && t.engagementId) {
        done.current = true;
        nav.consume();
        router.replace(`/clientes/${t.projectId}/projetos/${t.engagementId}?task=${taskId}`);
      } else if (taskDetail.isError) {
        // Tarefa removida/sem acesso → não trava no spinner; cai no cliente (ou na lista).
        done.current = true;
        nav.consume();
        router.replace(pending?.projectId ? `/clientes/${pending.projectId}` : "/clientes");
      }
      return;
    }

    // 2) Sem tarefa → escolhe o projeto do cliente-alvo (geral, senão o primeiro).
    if (!targetClient) return;
    const eng = engagements.data?.find((e) => e.isGeneral) ?? engagements.data?.[0];
    if (eng) {
      done.current = true;
      nav.consume();
      router.replace(`/clientes/${targetClient}/projetos/${eng.id}`);
    } else if (engagements.isSuccess || engagements.isError) {
      // Cliente sem projeto (raro) ou falha ao listar → cai no detalhe do cliente.
      done.current = true;
      nav.consume();
      router.replace(`/clientes/${targetClient}`);
    }
  }, [
    taskId,
    taskDetail.data,
    taskDetail.isError,
    targetClient,
    engagements.data,
    engagements.isSuccess,
    engagements.isError,
    pending?.projectId,
    nav,
    router,
  ]);

  if (projects.isLoading) return <BoardSkeleton />;
  if (projects.isError) return <BoardError onRetry={() => projects.refetch()} />;
  if ((projects.data?.length ?? 0) === 0) return <EmptyClients onCreate={() => router.push("/clientes")} />;

  return (
    <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
