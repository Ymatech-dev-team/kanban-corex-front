import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryField, parsePrefix, matchesSuggestion, type QueryChip, type QuerySuggestionGroup } from "./query-field";

const GROUPS: QuerySuggestionGroup[] = [
  { prefix: "cliente", options: [{ id: "c1", label: "IMA" }, { id: "c2", label: "Conexão MT" }] },
  { prefix: "projeto", options: [{ id: "p1", label: "Operação loja" }] },
  { prefix: "responsável", options: [{ id: "u1", label: "Ana Lima" }] },
  { prefix: "estado", options: [{ id: "rodando", label: "Rodando" }, { id: "voce", label: "Esperando você" }] },
];

function setup(props: Partial<React.ComponentProps<typeof QueryField>> = {}) {
  const onValueChange = vi.fn();
  const onRemoveChip = vi.fn();
  const onPick = vi.fn();
  const ui = (p: Partial<React.ComponentProps<typeof QueryField>> = {}) => (
    <>
      <button>fora</button>
      <input aria-label="outro campo" />
      <QueryField value="" onValueChange={onValueChange} chips={[]} onRemoveChip={onRemoveChip} groups={GROUPS} onPick={onPick} {...props} {...p} />
    </>
  );
  const utils = render(ui());
  return { ...utils, ui, onValueChange, onRemoveChip, onPick };
}
const field = () => screen.getByRole("combobox", { name: "Buscar tarefas" });

describe("parsePrefix / matchesSuggestion", () => {
  it("reconhece o prefixo sem diferenciar acento e maiúscula", () => {
    expect(parsePrefix("Responsavel:an", GROUPS)?.group.prefix).toBe("responsável");
    expect(parsePrefix("CLIENTE:", GROUPS)?.group.prefix).toBe("cliente");
    expect(parsePrefix("contrato: urgente", GROUPS)).toBeNull();
    expect(parsePrefix("contrato", GROUPS)).toBeNull();
  });
  it("o filtro das sugestões casa só com o mesmo prefixo e pelo que vem depois dele", () => {
    expect(matchesSuggestion("cliente:IMA", "cliente:")).toBe(true);
    expect(matchesSuggestion("cliente:Conexão MT", "cliente:cone")).toBe(true);
    expect(matchesSuggestion("cliente:IMA", "cliente:cone")).toBe(false);
    expect(matchesSuggestion("projeto:IMA", "cliente:ima")).toBe(false);
    expect(matchesSuggestion("responsável:Ana", "Responsavel:an")).toBe(true);
    expect(matchesSuggestion("estado:Esperando você", "estado:espe")).toBe(true);
    expect(matchesSuggestion("cliente:IMA", "texto livre")).toBe(false);
    expect(matchesSuggestion("cliente:IMA", "")).toBe(false);
  });
});

describe("QueryField", () => {
  describe("debounce", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

    it("envia a busca só 300 ms depois da última tecla, aparada", () => {
      const { onValueChange } = setup();
      type("  contr");
      act(() => { vi.advanceTimersByTime(200); });
      type("  contrato ");
      act(() => { vi.advanceTimersByTime(299); });
      expect(onValueChange).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(2); });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith("contrato");
    });

    it("texto com prefixo de filtro (cliente:…) não vira busca por título", () => {
      const { onValueChange } = setup();
      type("cliente:IM");
      act(() => { vi.advanceTimersByTime(1000); });
      expect(onValueChange).not.toHaveBeenCalled(); // não havia q: nada a remover
    });

    it("com q ativo, limpar o campo e digitar um prefixo remove o q depois do debounce (não congela o valor antigo)", () => {
      const { onValueChange } = setup({ value: "relat" });
      expect(field()).toHaveValue("relat");
      type("");
      type("estado:");
      act(() => { vi.advanceTimersByTime(299); });
      expect(onValueChange).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(2); });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith("");
      expect(field()).toHaveValue("estado:"); // o texto digitado continua no campo
    });

    it("com q ativo, digitar direto um prefixo no lugar do texto também remove o q", () => {
      const { onValueChange } = setup({ value: "relat" });
      type("projeto:op");
      act(() => { vi.advanceTimersByTime(301); });
      expect(onValueChange).toHaveBeenCalledWith("");
    });

    it("texto com dois-pontos que não é prefixo conhecido continua sendo busca", () => {
      const { onValueChange } = setup();
      type("contrato: urgente");
      act(() => { vi.advanceTimersByTime(301); });
      expect(onValueChange).toHaveBeenCalledWith("contrato: urgente");
    });

    it("limita a busca a 100 caracteres (o backend responde 400 acima disso)", () => {
      const { onValueChange } = setup();
      expect(field()).toHaveAttribute("maxlength", "100");
      type("x".repeat(130));
      act(() => { vi.advanceTimersByTime(301); });
      expect(onValueChange).toHaveBeenCalledWith("x".repeat(100));
    });

    it("apagar o texto limpa a busca (envia vazio) depois do debounce", () => {
      const { onValueChange, ui, rerender } = setup({ value: "contrato" });
      type("");
      act(() => { vi.advanceTimersByTime(301); });
      expect(onValueChange).toHaveBeenCalledWith("");
      rerender(ui({ value: "" }));
    });
  });

  it("segue o valor externo (voltar/avançar do navegador)", () => {
    const { rerender, ui } = setup({ value: "contrato" });
    expect(field()).toHaveValue("contrato");
    rerender(ui({ value: "" }));
    expect(field()).toHaveValue("");
    rerender(ui({ value: "login" }));
    expect(field()).toHaveValue("login");
  });

  it("mostra as fichas e remover uma chama onRemoveChip com a chave do filtro", async () => {
    const chips: QueryChip[] = [{ key: "cliente", label: "cliente", value: "IMA" }, { key: "prazo", label: "prazo", value: "Atrasadas" }];
    const { onRemoveChip } = setup({ chips });
    expect(screen.getByText("IMA")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Remover filtro prazo/ }));
    expect(onRemoveChip).toHaveBeenCalledWith("prazo");
  });

  it("Backspace no campo vazio remove a última ficha; com texto, não", async () => {
    const chips: QueryChip[] = [{ key: "cliente", label: "cliente", value: "IMA" }, { key: "prazo", label: "prazo", value: "Atrasadas" }];
    const { onRemoveChip } = setup({ chips });
    await userEvent.click(field());
    await userEvent.keyboard("{Backspace}");
    expect(onRemoveChip).toHaveBeenCalledWith("prazo");
    onRemoveChip.mockClear();
    await userEvent.keyboard("ab{Backspace}");
    expect(onRemoveChip).not.toHaveBeenCalled();
  });

  it("`/` foca o campo quando nenhum campo de texto está focado", async () => {
    setup();
    expect(field()).not.toHaveFocus();
    await userEvent.keyboard("/");
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue(""); // a barra não é digitada
  });

  it("`/` dentro de outro campo de texto não rouba o foco", async () => {
    setup();
    const other = screen.getByRole("textbox", { name: "outro campo" });
    await userEvent.click(other);
    await userEvent.keyboard("a/b");
    expect(other).toHaveFocus();
    expect(other).toHaveValue("a/b");
  });

  it("hotkey desligada não captura `/`", async () => {
    setup({ hotkey: false });
    await userEvent.keyboard("/");
    expect(field()).not.toHaveFocus();
  });

  it("digitar `cliente:` sugere os clientes; escolher chama onPick e limpa o campo", async () => {
    const { onPick, onValueChange } = setup();
    await userEvent.click(field());
    await userEvent.keyboard("cliente:");
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["IMA", "Conexão MT"]);
    await userEvent.click(options[1]);
    expect(onPick).toHaveBeenCalledWith("cliente", "c2");
    expect(field()).toHaveValue("");
    expect(onValueChange).not.toHaveBeenCalled(); // não houve busca por título
  });

  it("sugestões de estado: prefixo parcial do valor filtra", async () => {
    const { onPick } = setup();
    await userEvent.click(field());
    await userEvent.keyboard("estado:esp");
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Esperando você"]);
    await userEvent.click(options[0]);
    expect(onPick).toHaveBeenCalledWith("estado", "voce");
  });

  it("texto sem prefixo não abre sugestões", async () => {
    setup();
    await userEvent.click(field());
    await userEvent.keyboard("contrato");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    fireEvent.blur(field());
  });
});
