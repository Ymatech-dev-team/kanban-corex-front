import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CostTab } from "./cost-tab";
import { useProjectCost } from "@/lib/hooks/use-cost";
import type { ProjectCost } from "@/lib/types";

vi.mock("@/lib/hooks/use-cost", () => ({ useProjectCost: vi.fn() }));
vi.mock("@/lib/hooks/use-engagement-board", () => ({
  useEngagementCost: () => ({ isLoading: false, isError: false, data: undefined }),
}));
const mockCost = vi.mocked(useProjectCost);

function state(data: ProjectCost | undefined, extra: Partial<ReturnType<typeof useProjectCost>> = {}) {
  return { isLoading: false, isError: false, data, refetch: vi.fn(), ...extra } as ReturnType<typeof useProjectCost>;
}

const noInc = { semResponsavel: 0, semRemuneracao: 0, semHoras: 0, respSemAcesso: 0 };

beforeEach(() => mockCost.mockReset());

describe("CostTab", () => {
  it("mostra realizado/planejado formatados e a pessoa na tabela", () => {
    mockCost.mockReturnValue(
      state({
        realizadoCents: 240000,
        planejadoCents: 600000,
        incompletos: noInc,
        porPessoa: [{ userId: "u1", name: "Guto", realizadoCents: 240000, planejadoCents: 600000, horasAbertoMin: 9000 }],
        moeda: "BRL",
      }),
    );
    render(<CostTab projectId="p1" canSeeCost={true} />);
    // aparece no card (total) e na linha da pessoa
    expect(screen.getAllByText("R$ 2.400,00").length).toBe(2);
    expect(screen.getAllByText("R$ 6.000,00").length).toBe(2);
    expect(screen.getByText("Guto")).toBeInTheDocument();
    expect(screen.getByText("150h")).toBeInTheDocument();
    expect(screen.queryByText(/Estimativa incompleta/)).not.toBeInTheDocument();
  });

  it("mostra o aviso de incompleto com os motivos quando há tarefas fora da conta", () => {
    mockCost.mockReturnValue(
      state({
        realizadoCents: 100000,
        planejadoCents: 0,
        incompletos: { ...noInc, semHoras: 2, semResponsavel: 1 },
        porPessoa: [{ userId: "u1", name: "Ana", realizadoCents: 100000, planejadoCents: 0, horasAbertoMin: 0 }],
        moeda: "BRL",
      }),
    );
    render(<CostTab projectId="p1" canSeeCost={true} />);
    expect(screen.getByText(/Estimativa incompleta: 3 tarefas fora da conta/)).toBeInTheDocument();
    expect(screen.getByText(/2 sem horas estimadas/)).toBeInTheDocument();
    expect(screen.getByText(/1 sem responsável/)).toBeInTheDocument();
  });

  it("quando tudo é incompleto, não mostra R$ 0,00 e sim — nos cards", () => {
    mockCost.mockReturnValue(
      state({
        realizadoCents: 0,
        planejadoCents: 0,
        incompletos: { ...noInc, semHoras: 4 },
        porPessoa: [],
        moeda: "BRL",
      }),
    );
    render(<CostTab projectId="p1" canSeeCost={true} />);
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Estimativa incompleta: 4 tarefas/)).toBeInTheDocument();
  });

  it("sem dado nenhum → estado vazio", () => {
    mockCost.mockReturnValue(
      state({ realizadoCents: 0, planejadoCents: 0, incompletos: noInc, porPessoa: [], moeda: "BRL" }),
    );
    render(<CostTab projectId="p1" canSeeCost={true} />);
    expect(screen.getByText("Sem custos ainda")).toBeInTheDocument();
  });

  it("erro de rede → mensagem de retry", () => {
    mockCost.mockReturnValue(state(undefined, { isError: true }));
    render(<CostTab projectId="p1" canSeeCost={true} />);
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
  });
});
