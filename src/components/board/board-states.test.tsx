import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { BoardError, EmptyClients, EmptyTasks, RowsSkeleton } from "./board-states";
import { BulkActionBar } from "./bulk-action-bar";

it("erro: Alert de perigo do HeroUI com 'Tentar de novo', sem ícone em moldura", async () => {
  const retry = vi.fn();
  const { container } = render(<BoardError onRetry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
  expect(container.querySelector(".rounded-full")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it("vazios: título, uma linha e a ação abaixo, alinhados à esquerda e sem ícone em moldura", async () => {
  const create = vi.fn();
  const add = vi.fn();
  const { container, rerender } = render(<EmptyClients onCreate={create} />);
  expect(screen.getByRole("heading", { name: "Nenhum cliente ainda" })).toBeInTheDocument();
  expect(container.querySelector("svg")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Criar primeiro cliente" }));
  expect(create).toHaveBeenCalled();
  rerender(<EmptyTasks onAdd={add} />);
  expect(container.querySelector("svg")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Criar primeira tarefa" }));
  expect(add).toHaveBeenCalled();
});

it("esqueleto em linhas tem nome acessível", () => {
  render(<RowsSkeleton />);
  expect(screen.getByRole("status", { name: "Carregando tarefas" })).toBeInTheDocument();
});

it("barra de ações em massa: contêiner de 2px e botões de 4px, sem pílula", () => {
  const { container } = render(<BulkActionBar count={2} canMove canDelete pending={false} onMoveTo={vi.fn()} onDelete={vi.fn()} onClear={vi.fn()} />);
  expect(container.querySelector(".rounded-full")).toBeNull();
  expect(container.querySelector(".rounded-sm")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Excluir" }).className).toContain("rounded-md");
});
