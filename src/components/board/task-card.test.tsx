import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskCard, TaskCardExtrasProvider } from "./task-card";
import { deriveLiveStatus, type LiveStatus } from "@/lib/live-status";
import type { Task } from "@/lib/types";
import type { WorkflowState } from "@sistema-tasks/contracts";

const base: Task = {
  id: "t1",
  projectId: "p1",
  title: "Revisar contrato",
  description: null,
  status: "TODO",
  priority: "HIGH",
  dueDate: null,
  assigneeId: null,
  position: 1,
};

describe("TaskCard", () => {
  it("mostra título e prioridade em traços com rótulo acessível (sem depender de cor)", () => {
    render(<TaskCard task={base} membersById={{}} />);
    expect(screen.getByText("Revisar contrato")).toBeInTheDocument();
    const prio = screen.getByRole("img", { name: "Prioridade alta" });
    expect(prio.querySelectorAll('[data-bar="on"]')).toHaveLength(3);
  });

  it("prioridade média e baixa acendem 2 e 1 traços", () => {
    const { rerender } = render(<TaskCard task={{ ...base, priority: "MEDIUM" }} membersById={{}} />);
    expect(screen.getByRole("img", { name: "Prioridade média" }).querySelectorAll('[data-bar="on"]')).toHaveLength(2);
    rerender(<TaskCard task={{ ...base, priority: "LOW" }} membersById={{}} />);
    expect(screen.getByRole("img", { name: "Prioridade baixa" }).querySelectorAll('[data-bar="on"]')).toHaveLength(1);
  });

  it("marca atrasada quando o prazo venceu e não está feita", () => {
    render(<TaskCard task={{ ...base, dueDate: "2020-01-01T00:00:00.000Z" }} membersById={{}} />);
    const due = screen.getByText(/venceu/);
    expect(due).toBeInTheDocument();
    expect(due.className).toContain("mono");
    expect(due.className).toContain("text-warning"); // vencido é âmbar; vermelho fica só para Sem sinal e Bloqueada
    expect(due.className).not.toContain("text-danger");
  });

  it("título limitado a 2 linhas", () => {
    render(<TaskCard task={base} membersById={{}} />);
    expect(screen.getByText("Revisar contrato").className).toContain("line-clamp-2");
  });

  it("mostra cliente › projeto no topo", () => {
    render(<TaskCard task={base} membersById={{}} clientName="IMA" projectName="Operação loja" />);
    expect(screen.getByText("IMA › Operação loja")).toBeInTheDocument();
  });

  it("tarefa feita fica riscada", () => {
    render(<TaskCard task={{ ...base, status: "DONE" }} membersById={{}} />);
    expect(screen.getByText("Revisar contrato").className).toContain("line-through");
  });

  it("com vários responsáveis mostra as iniciais do principal e o excedente como +N", () => {
    const membersById = { u1: "Ana Lima", u2: "Bia Melo", u3: "Caio Reis", u4: "Duda Sá" };
    render(
      <TaskCard
        task={{ ...base, assigneeId: "u1", extraAssigneeIds: ["u2", "u3", "u4"] }}
        membersById={membersById}
      />,
    );
    expect(screen.getByText("AL")).toBeInTheDocument(); // principal (iniciais)
    expect(screen.getByText("+3")).toBeInTheDocument(); // 4 responsáveis: principal + 3
  });

  it("sem fluxo, sem linha viva nem régua", () => {
    const { container } = render(<TaskCard task={base} membersById={{}} />);
    expect(container.querySelector("[data-live-line]")).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
  });
});

const NOW = new Date("2026-11-12T15:00:00Z");
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
function liveOf(over: Partial<WorkflowState> = {}, extra: { openActionForMe?: { kind: string; question: string } } = {}): LiveStatus {
  const state = {
    taskId: "t1", orgId: "o", version: 1, stage: "DOING", deliveryRevision: 1, responsibleId: "u1", criteria: [], context: "", executorIds: [], reviews: [], findings: [],
    summary: { objective: "Integrar POS", completed: ["a", "b", "c"], remaining: ["d", "e", "f"], nextStep: "Rodar testes de conciliação", blockers: [], references: [], updatedAt: at(3), updatedBy: "u1", channel: "MCP" },
    execution: { id: "e1", agent: "Claude", ownerId: "u1", channel: "MCP", status: "RUNNING", lastUpdatedAt: at(3) },
    ...over,
  } as WorkflowState;
  return deriveLiveStatus({ state, updatedAt: at(3), responsibleName: "Marina", ...extra }, NOW);
}

describe("TaskCard com fluxo (RF25)", () => {
  it("mostra a linha viva (marca + estado + frase + tempo) e a régua de passos", () => {
    const { container } = render(<TaskCard task={base} membersById={{}} live={liveOf()} />);
    const line = container.querySelector("[data-live-line]")!;
    expect(line).toHaveAttribute("data-live-line", "running");
    expect(line.textContent).toContain("Rodando");
    expect(line.textContent).toContain("Rodar testes de conciliação");
    expect(line.querySelector("time")).not.toBeNull();
    expect(line.querySelector("[data-status-mark]")).not.toBeNull();
    expect(screen.getByRole("meter", { name: "3 de 6 passos" })).toBeInTheDocument();
  });

  it("esperando você mostra a pergunta; sem sinal destaca o estado", () => {
    const you = liveOf({}, { openActionForMe: { kind: "DECIDE", question: "Stone ou Cielo?" } });
    const { container, rerender } = render(<TaskCard task={base} membersById={{}} live={you} />);
    expect(container.querySelector("[data-live-line]")!.textContent).toContain("Esperando você");
    expect(container.querySelector("[data-live-line]")!.textContent).toContain("Stone ou Cielo?");
    const silent = liveOf({ execution: { id: "e1", agent: "Claude", ownerId: "u1", channel: "MCP", status: "RUNNING", lastUpdatedAt: at(120) } as WorkflowState["execution"], summary: { objective: "x", completed: [], remaining: ["a"], nextStep: "a", blockers: [], references: [], updatedAt: at(120), updatedBy: "u1", channel: "MCP" } });
    rerender(<TaskCard task={base} membersById={{}} live={silent} />);
    expect(container.querySelector("[data-live-line]")).toHaveAttribute("data-live-line", "silent");
    expect(screen.getByText("Sem sinal").parentElement!.className).toContain("text-danger");
  });

  it("o estado vivo também chega pelo contexto (o Kanban congelado não repassa props)", () => {
    const { container } = render(
      <TaskCardExtrasProvider value={{ live: { t1: liveOf() }, engagementNameById: { e1: "Operação loja" } }}>
        <TaskCard task={{ ...base, engagementId: "e1" }} membersById={{}} clientName="IMA" />
      </TaskCardExtrasProvider>,
    );
    expect(container.querySelector("[data-live-line]")).toHaveAttribute("data-live-line", "running");
    expect(screen.getByText("IMA › Operação loja")).toBeInTheDocument();
  });

  it("tarefa concluída não mostra linha viva, mesmo com fluxo no contexto", () => {
    const { container } = render(
      <TaskCardExtrasProvider value={{ live: { t1: liveOf() } }}>
        <TaskCard task={{ ...base, status: "DONE" }} membersById={{}} />
      </TaskCardExtrasProvider>,
    );
    expect(container.querySelector("[data-live-line]")).toBeNull();
    expect(screen.getByText("Revisar contrato").className).toContain("line-through");
  });
});

it("o nome do botão é só o título; a linha viva e o rodapé vão em aria-describedby (nada escondido por aria-label)", () => {
  const live = deriveLiveStatus({ state: { taskId: "t1", orgId: "o", version: 1, stage: "DOING", deliveryRevision: 1, responsibleId: "u1", criteria: [], context: "", executorIds: [], reviews: [], findings: [],
    summary: { objective: "x", completed: [], remaining: ["a"], nextStep: "Rodar testes", blockers: [], references: [], updatedAt: new Date().toISOString(), updatedBy: "u", channel: "MCP" },
    execution: { id: "e", agent: "Claude", ownerId: "u1", channel: "MCP", status: "RUNNING", lastUpdatedAt: new Date().toISOString() } } as never, updatedAt: new Date().toISOString() }, new Date());
  render(<TaskCard task={{ ...base, dueDate: "2020-01-01T00:00:00.000Z" }} membersById={{}} onOpen={vi.fn()} asButton live={live} />);
  const button = screen.getByRole("button", { name: base.title });
  expect(button).not.toHaveAttribute("aria-label");
  const description = button.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)!.textContent).join(" ");
  expect(description).toContain("Rodando");
  expect(description).toContain("venceu");
});

it("opens the task with the keyboard through the HeroUI button", async () => {
  const open = vi.fn();
  render(<TaskCard task={base} membersById={{}} onOpen={open} asButton />);
  await userEvent.tab();
  expect(screen.getByRole("button", {name: base.title})).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(open).toHaveBeenCalledTimes(1);
});
