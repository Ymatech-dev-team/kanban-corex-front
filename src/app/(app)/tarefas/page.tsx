"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GlobalTasksView } from "@/components/tasks/global-tasks-view";

/**
 * Visão GLOBAL de tarefas (entrada da sidebar): todas as tarefas acessíveis + filtros.
 * O board por projeto vive em /clientes/[id]/projetos/[engagementId]; os deep-links (Home/sino)
 * vão DIRETO pra lá (sem passar por aqui). [tarefas-visao-global RF-B1/B3]
 */
export default function TarefasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <GlobalTasksView />
    </Suspense>
  );
}
