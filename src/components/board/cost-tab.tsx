"use client";

import { Wallet } from "lucide-react";
import { useProjectCost } from "@/lib/hooks/use-cost";
import { useEngagementCost } from "@/lib/hooks/use-engagement-board";
import { CostSummary } from "@/components/cost/cost-summary";
import { BoardError } from "./board-states";

function CostSkeleton() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="mt-4 h-[140px] animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}

export function CostTab({
  projectId,
  engagementId,
  canSeeCost,
}: {
  projectId: string;
  engagementId?: string; // presente = custo do PROJETO; ausente = custo do cliente (roll-up)
  canSeeCost: boolean;
}) {
  const clientCost = useProjectCost(projectId, canSeeCost && !engagementId);
  const engCost = useEngagementCost(engagementId ?? "", canSeeCost && !!engagementId);
  const cost = engagementId ? engCost : clientCost;

  if (cost.isLoading) return <CostSkeleton />;
  if (cost.isError) return <BoardError onRetry={() => cost.refetch()} />;

  const data = cost.data;
  if (!data) return <CostSkeleton />;

  const inc = data.incompletos;
  const hasIncompletos = inc.semResponsavel + inc.semRemuneracao + inc.semHoras + inc.respSemAcesso > 0;

  // Sem nenhum dado: nem custo, nem incompletos → cliente sem tarefas com estimativa.
  if (data.porPessoa.length === 0 && !hasIncompletos) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <Wallet className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-medium tracking-tight">Sem custos ainda</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Defina horas estimadas e responsáveis com remuneração para ver o custo de alocação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <CostSummary data={data} />
    </div>
  );
}
