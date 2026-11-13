import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CostSummary } from "./cost-summary";
import type { ProjectCost } from "@/lib/types";

const data: ProjectCost = {
  moeda: "BRL", realizadoCents: 10000, planejadoCents: 5000,
  incompletos: { semResponsavel: 0, semRemuneracao: 0, semHoras: 0, respSemAcesso: 0 },
  porPessoa: [{ userId: "person-1", name: "Pessoa de teste", realizadoCents: 10000, planejadoCents: 5000, horasAbertoMin: 120 }],
};

describe("CostSummary com tabela HeroUI", () => {
  it("preserva associação da pessoa às colunas de custo e horas", () => {
    render(<CostSummary data={data} />);
    const table = screen.getByRole("grid", { name: "Custo por pessoa" });
    expect(within(table).getByRole("columnheader", { name: "Pessoa" })).toBeInTheDocument();
    const row = within(table).getByRole("row", { name: /Pessoa de teste/ });
    expect(within(row).getByText(/100,00/)).toBeInTheDocument();
    expect(within(row).getByText(/50,00/)).toBeInTheDocument();
    expect(within(row).getByText(/2/)).toBeInTheDocument();
  });

  it("não apresenta custo zero enganoso quando tudo está incompleto", () => {
    render(<CostSummary data={{ ...data, porPessoa: [], incompletos: { ...data.incompletos, semHoras: 1 } }} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText(/1 tarefa fora da conta/)).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});
