"use client";

import Link from "next/link";
import { useMe } from "@/lib/hooks/use-me";
import { Button } from "@/components/ui/button";
import { PendingActions } from "@/components/tasks/pending-actions";
import { TaskOverview } from "@/components/tasks/task-overview";
import { WorkflowMonitoring } from "@/components/tasks/workflow-monitoring";

export default function HomePage() {
  const me = useMe();
  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">Olá{me.data?.name ? `, ${me.data.name.split(" ")[0]}` : ""}!</p><h1 className="text-2xl font-semibold tracking-tight">Seu trabalho, em andamento.</h1><p className="text-sm text-muted-foreground">Acompanhe a execução, as revisões e os resultados dos planos aprovados.</p></div><Button asChild variant="outline" size="sm"><Link href="/tarefas">Todas as tarefas</Link></Button></header>
    <section aria-label="Agenda, prazos e todas as minhas tarefas"><TaskOverview /></section>
    <PendingActions />
    <WorkflowMonitoring />
    </div>
  </div>;
}
