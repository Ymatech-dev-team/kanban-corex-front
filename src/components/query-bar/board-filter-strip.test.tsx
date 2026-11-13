import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoardFilterStrip } from "@/components/board/board-filters-ui";
import type { BoardFilters } from "@/lib/board-filters";
import type { Preset } from "@/lib/hooks/use-board-filters";

vi.mock("@/lib/hooks/use-board-filters", () => ({ presetsKey: () => ["k"], useSavePreset: vi.fn(), useUpdatePreset: vi.fn(), useDeletePreset: vi.fn() }));

const PRESETS: Preset[] = [
  { id: "p1", name: "Urgentes", filters: { prio: "HIGH" }, createdAt: "2026-11-01T00:00:00Z" },
  { id: "p2", name: "Sem dono", filters: { resp: "none" }, createdAt: "2026-11-02T00:00:00Z" },
];
const MEMBERS = [{ id: "u1", name: "Ana Lima" }];

function setup(filters: BoardFilters = {}, over: Partial<React.ComponentProps<typeof BoardFilterStrip>> = {}) {
  const fns = { onApply: vi.fn(), onSave: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onRetry: vi.fn(), onChange: vi.fn(), onSearchChange: vi.fn() };
  render(
    <BoardFilterStrip
      presets={PRESETS}
      isLoading={false}
      isError={false}
      activeId={null}
      canSave={Object.keys(filters).length > 0}
      filters={filters}
      showStatus={false}
      members={MEMBERS}
      search=""
      {...fns}
      {...over}
    />,
  );
  return fns;
}

describe("BoardFilterStrip (quadro do projeto)", () => {
  it("os presets do servidor viram visões, depois de 'Todas'", () => {
    setup();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Todas", "Urgentes", "Sem dono"]);
    expect(screen.getByRole("tab", { name: "Todas" })).toHaveAttribute("aria-selected", "true");
  });

  it("escolher uma visão aplica o preset; 'Todas' limpa os filtros", async () => {
    const { onApply, onChange } = setup({ prio: "HIGH" }, { activeId: "p1" });
    expect(screen.getByRole("tab", { name: "Urgentes" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Sem dono" }));
    expect(onApply).toHaveBeenCalledWith(PRESETS[1]);
    await userEvent.click(screen.getByRole("tab", { name: "Todas" }));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("filtros que não são um preset aparecem como 'Filtro atual' e podem ser salvos", async () => {
    const { onSave } = setup({ prazo: "hoje" });
    expect(screen.getByRole("tab", { name: "Filtro atual" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("button", { name: /Salvar visão/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renomear e excluir agem sobre o preset ativo", async () => {
    const { onRename, onDelete } = setup({ prio: "HIGH" }, { activeId: "p1" });
    await userEvent.click(screen.getByRole("button", { name: "Renomear" }));
    await userEvent.click(screen.getByRole("button", { name: "Remover visão" }));
    expect(onRename).toHaveBeenCalledWith(PRESETS[0]);
    expect(onDelete).toHaveBeenCalledWith(PRESETS[0]);
  });

  it("as facetas atuais viram fichas e remover uma limpa só aquela faceta", async () => {
    const { onChange } = setup({ resp: "u1", prio: "HIGH" });
    expect(screen.getByText("Ana Lima")).toBeInTheDocument();
    expect(screen.getByText("Alta", { selector: "b" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Remover filtro prioridade/ }));
    expect(onChange).toHaveBeenCalledWith({ resp: "u1", prio: undefined });
  });

  it("'sem responsável' tem ficha própria", () => {
    setup({ resp: "none" });
    expect(screen.getByText("Sem responsável", { selector: "b" })).toBeInTheDocument();
  });

  it("a etapa só aparece fora do Quadro", () => {
    setup({ status: "DOING" }, { showStatus: false });
    expect(screen.queryByText("Fazendo", { selector: "b" })).toBeNull();
  });

  it("a etapa (A fazer/Fazendo/Feito) aparece como ficha na Lista, rotulada 'etapa'", () => {
    setup({ status: "DOING" }, { showStatus: true });
    expect(screen.getByText("Fazendo", { selector: "b" }).previousElementSibling).toHaveTextContent("etapa");
  });

  it("a busca local por título sobe depois do debounce", () => {
    vi.useFakeTimers();
    try {
      const { onSearchChange } = setup();
      fireEvent.change(screen.getByRole("combobox", { name: "Buscar tarefas" }), { target: { value: "contrato" } });
      act(() => { vi.advanceTimersByTime(301); });
      expect(onSearchChange).toHaveBeenCalledWith("contrato");
    } finally {
      vi.useRealTimers();
    }
  });

  it("digitar prioridade: sugere e aplica a prioridade", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("combobox", { name: "Buscar tarefas" }));
    await userEvent.keyboard("prioridade:ba");
    await userEvent.click(await screen.findByRole("option", { name: "Baixa" }));
    expect(onChange).toHaveBeenCalledWith({ prio: "LOW" });
  });

  it("erro ao carregar as visões oferece tentar de novo sem derrubar o resto", async () => {
    const { onRetry } = setup({}, { isError: true });
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Buscar tarefas" })).toBeInTheDocument();
  });
});
