import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalFilterBar } from "@/components/tasks/global-filter-bar";
import { filtersToSearchParams, parseFilters, type GlobalFilters } from "@/lib/global-filters";

const CLIENTS = [{ id: "c1", name: "IMA", description: null }, { id: "c2", name: "Conexão MT", description: null }];
const ENGS = [{ id: "e1", projectId: "c1", name: "Operação loja", description: null, taskCount: 1, consultorCount: 1, isGeneral: false }];
const MEMBERS = [{ id: "u1", name: "Ana Lima" }, { id: "u2", name: "Caio Reis" }];

function setup(filters: GlobalFilters = { status: "ATIVAS" }, over: Partial<React.ComponentProps<typeof GlobalFilterBar>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <GlobalFilterBar
      filters={filters}
      onChange={onChange}
      view="lista"
      onView={vi.fn()}
      clients={CLIENTS}
      engagements={ENGS}
      members={MEMBERS}
      projectoDisabled={false}
      respDisabled={false}
      countLabel="11 tarefas"
      showOpenBoard={false}
      onOpenBoard={vi.fn()}
      meId="u1"
      {...over}
    />,
  );
  return { ...utils, onChange };
}
const lastFilters = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as GlobalFilters;

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("GlobalFilterBar", () => {
  it("mostra as visões embutidas e marca a que bate com os filtros", () => {
    // A contagem é a da lista atual e só aparece na visão ativa; as outras abas não mostram número.
    setup({ status: "ATIVAS", fluxo: "rodando" }, { activeCount: 3 });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Ativas", "Minhas", "Rodando3", "Esperando você", "Atrasadas"]);
    expect(screen.getByRole("tab", { name: /Rodando/ })).toHaveAttribute("aria-selected", "true");
  });

  it("buscar dentro de uma visão não tira a visão ativa", () => {
    setup({ status: "ATIVAS", q: "contrato" });
    expect(screen.getByRole("tab", { name: /Ativas/ })).toHaveAttribute("aria-selected", "true");
  });

  it("filtros que não são nenhuma visão aparecem como 'Filtro atual'", () => {
    setup({ status: "ATIVAS", prio: "HIGH" });
    expect(screen.getByRole("tab", { name: "Filtro atual" })).toHaveAttribute("aria-selected", "true");
  });

  it("escolher uma visão aplica o conjunto de params dela", async () => {
    const { onChange } = setup({ status: "ATIVAS", cliente: "c1", prio: "HIGH" });
    await userEvent.click(screen.getByRole("tab", { name: /Esperando você/ }));
    expect(lastFilters(onChange)).toEqual({ status: "ATIVAS", fluxo: "voce" });
    await userEvent.click(screen.getByRole("tab", { name: /Minhas/ }));
    expect(lastFilters(onChange)).toEqual({ status: "ATIVAS", resp: "u1" });
  });

  it("sem usuário conhecido não oferece Minhas", () => {
    setup({ status: "ATIVAS" }, { meId: undefined });
    expect(screen.queryByRole("tab", { name: /Minhas/ })).toBeNull();
  });

  it("filtros ativos viram fichas; remover uma tira o param da URL e o cliente leva o projeto junto", async () => {
    const { onChange } = setup({ status: "ATIVAS", cliente: "c1", projeto: "e1", fluxo: "voce", prazo: "hoje" });
    expect(screen.getByText("IMA")).toBeInTheDocument();
    expect(screen.getByText("Operação loja")).toBeInTheDocument();
    expect(screen.getByText("Esperando você", { selector: "b" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Remover filtro estado/ }));
    expect(filtersToSearchParams(lastFilters(onChange)).has("fluxo")).toBe(false);
    expect(filtersToSearchParams(lastFilters(onChange)).get("prazo")).toBe("hoje");
    await userEvent.click(screen.getByRole("button", { name: /Remover filtro cliente/ }));
    const sp = filtersToSearchParams(lastFilters(onChange));
    expect(sp.has("cliente")).toBe(false);
    expect(sp.has("projeto")).toBe(false);
  });

  it("o contador de Filtros conta cliente, projeto, responsável e facetas, mas não a busca", () => {
    setup({ status: "ATIVAS", cliente: "c1", resp: "u1", fluxo: "rodando", q: "login" });
    expect(screen.getByLabelText("3 filtros ativos")).toBeInTheDocument();
  });

  it("digitar estado: sugere os estados do fluxo e escolher aplica o filtro", async () => {
    const { onChange } = setup();
    const field = screen.getByRole("combobox", { name: "Buscar tarefas" });
    await userEvent.click(field);
    await userEvent.keyboard("estado:esp");
    const option = await screen.findByRole("option", { name: "Esperando você" });
    await userEvent.click(option);
    expect(lastFilters(onChange).fluxo).toBe("voce");
    expect(field).toHaveValue("");
  });

  it("digitar cliente: sugere os clientes e escolher zera o projeto", async () => {
    const { onChange } = setup({ status: "ATIVAS", cliente: "c1", projeto: "e1" });
    await userEvent.click(screen.getByRole("combobox", { name: "Buscar tarefas" }));
    await userEvent.keyboard("cliente:cone");
    await userEvent.click(await screen.findByRole("option", { name: "Conexão MT" }));
    expect(lastFilters(onChange)).toMatchObject({ cliente: "c2", projeto: undefined });
  });

  it("a busca por título vai para q na URL depois do debounce, preservando os outros filtros", () => {
    vi.useFakeTimers();
    try {
      const { onChange } = setup({ status: "ATIVAS", cliente: "c1" });
      fireEvent.change(screen.getByRole("combobox", { name: "Buscar tarefas" }), { target: { value: "contrato" } });
      expect(onChange).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(301); });
      const sp = filtersToSearchParams(lastFilters(onChange));
      expect(sp.get("q")).toBe("contrato");
      expect(sp.get("cliente")).toBe("c1");
      expect(parseFilters(new URLSearchParams(sp.toString())).q).toBe("contrato");
    } finally {
      vi.useRealTimers();
    }
  });

  it("com q na URL, apagar o campo e digitar estado: tira o q da URL, mantendo os outros filtros", () => {
    vi.useFakeTimers();
    try {
      const { onChange } = setup({ status: "ATIVAS", cliente: "c1", q: "relat" });
      const field = screen.getByRole("combobox", { name: "Buscar tarefas" });
      expect(field).toHaveValue("relat");
      fireEvent.change(field, { target: { value: "" } });
      fireEvent.change(field, { target: { value: "estado:" } });
      act(() => { vi.advanceTimersByTime(301); });
      const sp = filtersToSearchParams(lastFilters(onChange));
      expect(sp.has("q")).toBe(false);
      expect(sp.get("cliente")).toBe("c1");
    } finally {
      vi.useRealTimers();
    }
  });

  describe("visões salvas no navegador (RF24)", () => {
    it("salvar grava em sdt_tarefas_visoes e a visão vira uma aba que reaplica os filtros", async () => {
      const { onChange, rerender } = setup({ status: "ATIVAS", cliente: "c1", prazo: "semana", q: "texto" });
      await userEvent.click(screen.getByRole("button", { name: /Salvar visão/ }));
      await userEvent.type(await screen.findByRole("textbox", { name: "Nome da visão" }), "IMA esta semana");
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
      const stored = JSON.parse(localStorage.getItem("sdt_tarefas_visoes:u1")!);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe("IMA esta semana");
      expect(stored[0].params).toBe("cliente=c1&prazo=semana"); // a busca por texto não entra na visão
      const tab = screen.getByRole("tab", { name: "IMA esta semana" });
      expect(tab).toBeInTheDocument();
      onChange.mockClear();
      await userEvent.click(screen.getByRole("tab", { name: /Ativas/ }));
      expect(lastFilters(onChange)).toEqual({ status: "ATIVAS" });
      rerender(<div />);
    });

    it("visões salvas anteriormente voltam na abertura", async () => {
      localStorage.setItem("sdt_tarefas_visoes:u1", JSON.stringify([{ id: "v1", name: "Alta prioridade", params: "prio=HIGH" }]));
      const { onChange } = setup();
      await userEvent.click(await screen.findByRole("tab", { name: "Alta prioridade" }));
      expect(lastFilters(onChange)).toEqual({ status: "ATIVAS", prio: "HIGH" });
    });

    it("storage que lança erro: a tela abre só com as embutidas e salvar não quebra", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
      setup({ status: "ATIVAS", prio: "HIGH" });
      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Ativas", "Minhas", "Rodando", "Esperando você", "Atrasadas", "Filtro atual"]);
      await userEvent.click(screen.getByRole("button", { name: /Salvar visão/ }));
      await userEvent.type(await screen.findByRole("textbox", { name: "Nome da visão" }), "Minha");
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(screen.getByRole("tab", { name: "Minha" })).toBeInTheDocument(); // vale na sessão
    });

    it("outro usuário no mesmo navegador não vê as visões; trocar de usuário recarrega", async () => {
      localStorage.setItem("sdt_tarefas_visoes:u1", JSON.stringify([{ id: "v1", name: "Da Ana", params: "cliente=c1&prio=HIGH" }]));
      localStorage.setItem("sdt_tarefas_visoes:u2", JSON.stringify([{ id: "v2", name: "Do Caio", params: "prazo=hoje" }]));
      const props: React.ComponentProps<typeof GlobalFilterBar> = {
        filters: { status: "ATIVAS" }, onChange: vi.fn(), view: "lista", onView: vi.fn(), clients: CLIENTS, engagements: ENGS, members: MEMBERS,
        projectoDisabled: false, respDisabled: false, countLabel: "", showOpenBoard: false, onOpenBoard: vi.fn(), meId: "u1",
      };
      const { rerender } = render(<GlobalFilterBar {...props} />);
      expect(await screen.findByRole("tab", { name: "Da Ana" })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Do Caio" })).toBeNull();
      rerender(<GlobalFilterBar {...props} meId="u2" />);
      expect(await screen.findByRole("tab", { name: "Do Caio" })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Da Ana" })).toBeNull();
      rerender(<GlobalFilterBar {...props} meId="u3" />);
      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Ativas", "Minhas", "Rodando", "Esperando você", "Atrasadas"]);
    });

    it("sem usuário conhecido: só as embutidas, a chave antiga é ignorada e não dá para salvar", () => {
      localStorage.setItem("sdt_tarefas_visoes", JSON.stringify([{ id: "old", name: "Legada", params: "prio=HIGH" }]));
      localStorage.setItem("sdt_tarefas_visoes:u1", JSON.stringify([{ id: "v1", name: "Da Ana", params: "prio=HIGH" }]));
      setup({ status: "ATIVAS", prio: "LOW" }, { meId: undefined });
      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Ativas", "Rodando", "Esperando você", "Atrasadas", "Filtro atual"]);
      expect(screen.queryByRole("button", { name: /Salvar visão/ })).toBeNull();
    });

    it("não salva visão sem nome nem com nome repetido", async () => {
      setup({ status: "ATIVAS", prio: "HIGH" });
      await userEvent.click(screen.getByRole("button", { name: /Salvar visão/ }));
      await userEvent.click(await screen.findByRole("button", { name: "Salvar" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Dê um nome");
      await userEvent.type(screen.getByRole("textbox", { name: "Nome da visão" }), "Rodando");
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Já existe");
      expect(localStorage.getItem("sdt_tarefas_visoes:u1")).toBeNull();
    });

    it("'+ Salvar visão' fica desabilitado quando os filtros já são uma visão", () => {
      setup({ status: "ATIVAS", fluxo: "rodando" });
      expect(screen.getByRole("button", { name: /Salvar visão/ })).toBeDisabled();
    });

    it("remover a visão ativa tira a aba e atualiza o storage", async () => {
      localStorage.setItem("sdt_tarefas_visoes:u1", JSON.stringify([{ id: "v1", name: "Alta prioridade", params: "prio=HIGH" }]));
      setup({ status: "ATIVAS", prio: "HIGH" });
      const tab = await screen.findByRole("tab", { name: "Alta prioridade" });
      expect(tab).toHaveAttribute("aria-selected", "true");
      await userEvent.click(screen.getByRole("button", { name: "Remover visão" }));
      // Pede confirmação antes de apagar.
      expect(screen.getByRole("tab", { name: "Alta prioridade", hidden: true })).toBeInTheDocument(); // o diálogo esconde o fundo
      expect(JSON.parse(localStorage.getItem("sdt_tarefas_visoes:u1")!)).toHaveLength(1);
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
      expect(screen.queryByRole("tab", { name: "Alta prioridade" })).toBeNull();
      expect(JSON.parse(localStorage.getItem("sdt_tarefas_visoes:u1")!)).toEqual([]);
    });
  });

  it("cancelar a confirmação mantém a visão", async () => {
    localStorage.setItem("sdt_tarefas_visoes:u1", JSON.stringify([{ id: "v1", name: "Alta prioridade", params: "prio=HIGH" }]));
    setup({ status: "ATIVAS", prio: "HIGH" });
    await screen.findByRole("tab", { name: "Alta prioridade" });
    await userEvent.click(screen.getByRole("button", { name: "Remover visão" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("tab", { name: "Alta prioridade" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("sdt_tarefas_visoes:u1")!)).toHaveLength(1);
  });

  it("filtro de etapa se chama Etapa (não confunde com o estado do fluxo)", () => {
    setup({ status: "DOING" });
    expect(screen.getByText("Fazendo", { selector: "b" }).previousElementSibling).toHaveTextContent("etapa");
  });

  it("título do h1 e alvos de toque no celular (min-h-11) nos botões de visualização", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Tarefas" }).className).toContain("text-[28px]");
    expect(screen.getByRole("radio", { name: "Quadro" }).className).toContain("max-md:min-h-11");
    expect(screen.getByRole("tab", { name: /Ativas/ }).className).toContain("max-md:min-h-11");
  });

  it("Quadro, Lista e Calendário trocam a visualização", async () => {
    const onView = vi.fn();
    setup({ status: "ATIVAS" }, { onView });
    const group = screen.getByRole("radiogroup", { name: "Visualização" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Quadro", "Lista", "Calendário"]);
    await userEvent.click(within(group).getByRole("radio", { name: "Calendário" }));
    expect(onView).toHaveBeenCalledWith("calendario");
  });
});
