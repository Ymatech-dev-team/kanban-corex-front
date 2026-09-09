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
    render(<TaskCard task={base} membersById={{}} />);
    expect(screen.getByText("Revisar contrato")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });

  it("marca atrasada quando o prazo venceu e não está feita", () => {
    render(<TaskCard task={{ ...base, dueDate: "2020-01-01T00:00:00.000Z" }} membersById={{}} />);
    expect(screen.getByText(/venceu/)).toBeInTheDocument();
  });

  it("tarefa feita fica riscada", () => {
    render(<TaskCard task={{ ...base, status: "DONE" }} membersById={{}} />);
    expect(screen.getByText("Revisar contrato").className).toContain("line-through");
  });

  it("com vários responsáveis mostra avatares e o excedente como +N", () => {
    const membersById = { u1: "Ana Lima", u2: "Bia Melo", u3: "Caio Reis", u4: "Duda Sá" };
    render(
      <TaskCard
        task={{ ...base, assigneeId: "u1", extraAssigneeIds: ["u2", "u3", "u4"] }}
        membersById={membersById}
      />,
    );
    expect(screen.getByText("AL")).toBeInTheDocument(); // principal (iniciais)
    expect(screen.getByText("+1")).toBeInTheDocument(); // 4 responsáveis, mostra 3 + "+1"
  });
});
