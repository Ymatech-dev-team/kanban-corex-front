import { AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { formatMinutesAsHours } from "@/lib/duration";
import type { ProjectCost } from "@/lib/types";

function CostCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="text-2xl font-medium tracking-tight tabular-nums">{value}</div>
      <div className="text-[12px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function IncompleteBanner({ inc }: { inc: ProjectCost["incompletos"] }) {
  const total = inc.semResponsavel + inc.semRemuneracao + inc.semHoras + inc.respSemAcesso;
  if (total === 0) return null;
  const reasons = [
    inc.semHoras && `${inc.semHoras} sem horas estimadas`,
    inc.semResponsavel && `${inc.semResponsavel} sem responsável`,
    inc.semRemuneracao && `${inc.semRemuneracao} sem remuneração`,
    inc.respSemAcesso && `${inc.respSemAcesso} com responsável sem acesso`,
  ].filter(Boolean);
  return (
    <div className="mb-5 flex items-start gap-2.5 border border-border border-l-[3px] border-l-amber bg-card px-3.5 py-3">
      <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-amber" strokeWidth={1.8} />
      <div className="text-[13px] leading-relaxed">
        <span className="font-medium">
          Estimativa incompleta: {total} {total === 1 ? "tarefa" : "tarefas"} fora da conta.
        </span>
        <br />
        <span className="text-muted-foreground">{reasons.join(" · ")}</span>
      </div>
    </div>
  );
}

/**
 * Corpo do resumo de custo (cards + banner + tabela por pessoa). Presentational puro:
 * recebe os dados já carregados, sem fetch nem chrome de layout. Reusado pela aba Custo
 * do quadro e pela seção Custo do detalhe do cliente. [design detalhe-do-cliente §4]
 */
export function CostSummary({ data }: { data: ProjectCost }) {
  const inc = data.incompletos;
  const hasIncompletos = inc.semResponsavel + inc.semRemuneracao + inc.semHoras + inc.respSemAcesso > 0;
  // Tudo incompleto (nenhuma pessoa com OK) → não mostrar "R$ 0,00" enganoso.
  const allIncomplete = data.porPessoa.length === 0 && hasIncompletos;
  const realizado = allIncomplete ? "—" : formatBRL(data.realizadoCents);
  const planejado = allIncomplete ? "—" : formatBRL(data.planejadoCents);

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CostCard
          label="Realizado (concluídas)"
          value={realizado}
          hint="Estimativa a preço de hoje — muda se a remuneração mudar."
        />
        <CostCard label="Planejado (em aberto)" value={planejado} hint="Soma das tarefas ainda não concluídas." />
      </div>

      <IncompleteBanner inc={inc} />

      {data.porPessoa.length > 0 && (
        <>
          <div className="mb-2 text-[13px] font-medium text-muted-foreground">Por pessoa</div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <caption className="sr-only">Custo por pessoa</caption>
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Pessoa</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Realizado</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Planejado</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Horas em aberto</th>
                </tr>
              </thead>
              <tbody>
                {data.porPessoa.map((p) => (
                  <tr key={p.userId} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">{p.name}</th>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(p.realizadoCents)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(p.planejadoCents)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatMinutesAsHours(p.horasAbertoMin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
