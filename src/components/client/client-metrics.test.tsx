import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientMetrics } from "./client-metrics";
import { useTasks } from "@/lib/hooks/use-tasks";
import type { Task } from "@/lib/types";

vi.mock("@/lib/hooks/use-tasks", () => ({ useTasks: vi.fn() }));
const mockTasks = vi.mocked(useTasks);

function task(p: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    projectId: "p1",
    title: "t",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    assigneeId: null,
    position: 1,
    ...p,
  };
}
function state(data: Task[] | undefined, extra: Partial<ReturnType<typeof useTasks>> = {}) {
  return { isLoading: false, isError: false, data, refetch: vi.fn(), ...extra } as ReturnType<typeof useTasks>;
}

beforeEach(() => mockTasks.mockReset());

describe("ClientMetrics", () => {
  it("conta por status e soma horas (total e em aberto)", () => {
    mockTasks.mockReturnValue(
      state([
        task({ status: "TODO", estimatedMinutes: 60 }),
        task({ status: "DOING", estimatedMinutes: 30 }),
        task({ status: "DONE", estimatedMinutes: 90 }),
      ]),
    );
    render(<ClientMetrics projectId="p1" canSeeCost />);
    expect(screen.getByText("Total de tarefas").nextSibling?.textContent).toBe("3");
    // total = 60+30+90 = 180min = 3h; aberto = 60+30 = 90min = 1h 30min
    expect(screen.getByText("3h")).toBeInTheDocument();
    expect(screen.getByText("1h 30min")).toBeInTheDocument();
  });

  it("exibe — quando nenhuma tarefa tem horas estimadas, e conta as sem estimativa", () => {
    mockTasks.mockReturnValue(
      state([task({ status: "TODO" }), task({ status: "DOING" })]),
    );
    render(<ClientMetrics projectId="p1" canSeeCost />);
    expect(screen.getAllByText("—").length).toBe(2); // horas estimadas + em aberto
    expect(screen.getByText("2 tarefas sem horas estimadas")).toBeInTheDocument();
  });

  it("tarefa sem estimativa não vira 0 na soma (mostra a contagem)", () => {
    mockTasks.mockReturnValue(
      state([task({ status: "TODO", estimatedMinutes: 120 }), task({ status: "TODO" })]),
    );
    render(<ClientMetrics projectId="p1" canSeeCost />);
    // só a de 120min conta (2h) — total e em aberto, já que a tarefa está aberta
    expect(screen.getAllByText("2h").length).toBe(2);
    expect(screen.getByText("1 tarefa sem horas estimadas")).toBeInTheDocument();
  });

  it("sem custos.ver → esconde os cards de horas, mantém as contagens [SEC-custo]", () => {
    mockTasks.mockReturnValue(
      state([task({ status: "TODO", estimatedMinutes: 60 }), task({ status: "DONE", estimatedMinutes: 90 })]),
    );
    render(<ClientMetrics projectId="p1" />); // canSeeCost default false
    expect(screen.getByText("Total de tarefas")).toBeInTheDocument();
    expect(screen.queryByText("Horas estimadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Horas em aberto")).not.toBeInTheDocument();
  });

  it("sem tarefas → estado vazio", () => {
    mockTasks.mockReturnValue(state([]));
    render(<ClientMetrics projectId="p1" />);
    expect(screen.getByText(/Sem tarefas neste cliente/)).toBeInTheDocument();
  });

  it("erro → mensagem com tentar de novo", () => {
    mockTasks.mockReturnValue(state(undefined, { isError: true }));
    render(<ClientMetrics projectId="p1" />);
    expect(screen.getByText(/Não foi possível carregar as métricas/)).toBeInTheDocument();
  });
});
