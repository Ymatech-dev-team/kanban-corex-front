import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TaskCard } from "./task-card";
import type { Task } from "@/lib/types";

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
  it("mostra título e rótulo de prioridade (sem depender de cor)", () => {
    render(<TaskCard task={base} />);
    expect(screen.getByText("Revisar contrato")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });

  it("marca atrasada quando o prazo venceu e não está feita", () => {
    render(<TaskCard task={{ ...base, dueDate: "2020-01-01T00:00:00.000Z" }} />);
    expect(screen.getByText(/venceu/)).toBeInTheDocument();
  });

  it("tarefa feita fica riscada", () => {
    render(<TaskCard task={{ ...base, status: "DONE" }} />);
    expect(screen.getByText("Revisar contrato").className).toContain("line-through");
  });
});
