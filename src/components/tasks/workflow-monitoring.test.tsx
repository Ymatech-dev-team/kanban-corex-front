import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowMonitoring } from "./workflow-monitoring";
const mock = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));
vi.mock("@/lib/hooks/use-workflow", () => ({ useWorkflowMonitoring: () => mock.query }));
const state = { taskId: "task-one", stage: "IN_REVIEW", deliveryRevision: 2, reviews: [{ deliveryRevision: 2, reviewMode: "AGENT", checks: ["typecheck", "lint", "test", "build"].map(name => ({ name, required: true, status: name === "lint" ? "failed" : "passed" })) }], findings: [], execution: { channel: "MCP", agent: "Claude", status: "FINISHED" } };
beforeEach(() => { mock.query = { data: { pages: [{ items: [{ taskId: "task-one", title: "Preço por unidade", clientName: "Cliente", projectName: "Catálogo", updatedAt: "2026-11-12T12:00:00Z", state }] }] } }; });
it("shows real failure and next action without asking for human approval", () => {
  render(<WorkflowMonitoring />);
  expect(screen.getByText("Correção pendente")).toBeInTheDocument();
  expect(screen.getByText(/O agente deve corrigir lint/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Preço por unidade/ })).toHaveAttribute("href", "/tarefas/task-one?from=%2F");
  expect(screen.queryByText(/Aprovar entrega/)).not.toBeInTheDocument();
});
it("never renders stale task data as a success after a permission error", () => {
  mock.query.isError = true; mock.query.error = { response: { status: 403 } };
  render(<WorkflowMonitoring />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText("Preço por unidade")).not.toBeInTheDocument();
  expect(screen.queryByText(/Nenhuma tarefa/)).not.toBeInTheDocument();
});
it("shows waiting execution accurately and keeps long text bounded", () => {
  const long = "<script>alert(1)</script>".repeat(300);
  mock.query = { data: { pages: [{ items: [{ taskId: "t", title: long, clientName: "Cliente", projectName: "Projeto", updatedAt: "2026-11-12T12:00:00Z", state: { ...state, stage: "DOING", execution: { channel: "MCP", agent: "Codex", status: "PAUSED" }, summary: { nextStep: long } } }] }] } };
  const { container } = render(<WorkflowMonitoring />);
  expect(screen.getByText("Aguardando retomada")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByRole("heading", { level: 3 })).toHaveClass("line-clamp-2");
});

it.each([[6, 5], [5, 6]])("keeps the newest task when pages overlap (%s then %s)", (first, second) => {
  const item = (version: number) => ({ taskId: "task-one", title: version === 6 ? "Título atualizado" : "Título antigo", clientName: "Cliente", projectName: "Catálogo", updatedAt: "2026-11-12T12:00:00Z", state: { ...state, version, stage: version === 6 ? "DONE" : "IN_REVIEW", reviews: [{ ...state.reviews[0], decidedChannel: "MCP", decidedAgent: "Codex" }] } });
  mock.query = { data: { pages: [{ items: [item(first)] }, { items: [item(second)] }] } };
  render(<WorkflowMonitoring />);
  expect(screen.getByText("Título atualizado")).toBeInTheDocument();
  expect(screen.queryByText("Título antigo")).not.toBeInTheDocument();
  expect(screen.getByText("Concluída pelo agente")).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
