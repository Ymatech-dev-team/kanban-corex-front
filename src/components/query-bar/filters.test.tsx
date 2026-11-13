import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FiltersControl, type FacetDef } from "./filters";

const facets = (over: Partial<Record<string, string>> = {}, onChange = vi.fn()): FacetDef[] => [
  { key: "cliente", label: "Cliente", value: over.cliente, options: [{ value: "c1", label: "IMA" }, { value: "c2", label: "Conexão MT" }], onChange: (v) => onChange("cliente", v) },
  { key: "prio", label: "Prioridade", kind: "segments", value: over.prio, options: [{ value: "HIGH", label: "Alta" }, { value: "LOW", label: "Baixa" }], onChange: (v) => onChange("prio", v) },
];

afterEach(() => vi.unstubAllGlobals());

describe("FiltersControl (RF21)", () => {
  it("o contador do botão mostra quantos filtros estão ativos", () => {
    const { rerender } = render(<FiltersControl facets={facets()} activeCount={0} />);
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent(/^Filtros$/);
    rerender(<FiltersControl facets={facets({ prio: "HIGH" })} activeCount={3} />);
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("3");
    expect(screen.getByLabelText("3 filtros ativos")).toBeInTheDocument();
  });

  it("desktop: abre um popover com as facetas", async () => {
    const onChange = vi.fn();
    render(<FiltersControl facets={facets({}, onChange)} activeCount={0} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const dialog = await screen.findByRole("dialog", { name: "Filtros" });
    expect(within(dialog).getByText("Prioridade")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Alta" }));
    expect(onChange).toHaveBeenCalledWith("prio", "HIGH");
  });

  it("escolher 'Todos' numa faceta de segmentos limpa o filtro", async () => {
    const onChange = vi.fn();
    render(<FiltersControl facets={facets({ prio: "HIGH" }, onChange)} activeCount={1} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const dialog = await screen.findByRole("dialog", { name: "Filtros" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Todos" }));
    expect(onChange).toHaveBeenCalledWith("prio", undefined);
  });

  it("'Limpar filtros' só aparece com filtro ativo", async () => {
    const onClear = vi.fn();
    const { rerender } = render(<FiltersControl facets={facets()} activeCount={0} onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await screen.findByRole("dialog", { name: "Filtros" });
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    rerender(<FiltersControl facets={facets({ prio: "HIGH" })} activeCount={1} onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("abaixo de 768 px abre uma folha inferior em vez de popover", async () => {
    // O jsdom não tem IntersectionObserver, que a folha usa para o arraste.
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
    Element.prototype.scrollTo = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<FiltersControl facets={facets()} activeCount={0} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const dialog = await screen.findByRole("dialog", { name: "Filtros" });
    expect(dialog.getAttribute("data-slot")).toBe("sheet-dialog");
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });
});
