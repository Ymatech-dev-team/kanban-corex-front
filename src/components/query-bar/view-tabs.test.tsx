import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ViewTabs } from "./view-tabs";

const VIEWS = [
  { id: "ativas", label: "Ativas", count: 23 },
  { id: "rodando", label: "Rodando", count: 3 },
  { id: "voce", label: "Esperando você" },
  { id: "salva", label: "IMA esta semana" },
];

describe("ViewTabs (RF19)", () => {
  it("mostra as visões como abas, a ativa selecionada, com contagem quando conhecida", () => {
    render(<ViewTabs views={VIEWS} activeId="rodando" onSelect={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Ativas23", "Rodando3", "Esperando você", "IMA esta semana"]);
    expect(screen.getByRole("tab", { name: /Rodando/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Ativas/ })).toHaveAttribute("aria-selected", "false");
    expect(within(screen.getByRole("tab", { name: /Esperando você/ })).queryByText(/^\d+$/)).toBeNull();
  });

  it("trocar de aba chama onSelect; clicar na já ativa não chama", async () => {
    const onSelect = vi.fn();
    render(<ViewTabs views={VIEWS} activeId="ativas" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("tab", { name: /Ativas/ }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("tab", { name: /Esperando você/ }));
    expect(onSelect).toHaveBeenCalledWith("voce");
  });

  it("navega entre abas pelo teclado", async () => {
    const onSelect = vi.fn();
    render(<ViewTabs views={VIEWS} activeId="ativas" onSelect={onSelect} />);
    screen.getByRole("tab", { name: /Ativas/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenCalledWith("rodando");
  });

  it("'+ Salvar visão' só aparece com onSave e respeita saveDisabled", async () => {
    const onSave = vi.fn();
    const { rerender } = render(<ViewTabs views={VIEWS} activeId="ativas" onSelect={() => {}} />);
    expect(screen.queryByRole("button", { name: /Salvar visão/ })).toBeNull();
    rerender(<ViewTabs views={VIEWS} activeId="ativas" onSelect={() => {}} onSave={onSave} saveDisabled />);
    expect(screen.getByRole("button", { name: /Salvar visão/ })).toBeDisabled();
    rerender(<ViewTabs views={VIEWS} activeId="ativas" onSelect={() => {}} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvar visão/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renomear e remover só para a visão ativa que é do usuário", async () => {
    const onRemove = vi.fn();
    const onRename = vi.fn();
    const { rerender } = render(<ViewTabs views={VIEWS} activeId="ativas" onSelect={() => {}} removableIds={["salva"]} onRemove={onRemove} onRename={onRename} />);
    expect(screen.queryByRole("button", { name: "Remover visão" })).toBeNull();
    rerender(<ViewTabs views={VIEWS} activeId="salva" onSelect={() => {}} removableIds={["salva"]} onRemove={onRemove} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Remover visão" }));
    await userEvent.click(screen.getByRole("button", { name: "Renomear" }));
    expect(onRemove).toHaveBeenCalledWith("salva");
    expect(onRename).toHaveBeenCalledWith("salva");
  });
});
