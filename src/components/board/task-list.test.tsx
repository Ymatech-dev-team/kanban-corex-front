import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TaskList } from "./task-list";
import { GlobalTaskTable } from "../tasks/global-task-table";
import { TaskCardExtrasProvider } from "./task-card";
import { deriveLiveStatus } from "@/lib/live-status";
import type { Task } from "@/lib/types";
const tasks = ["Alpha", "Beta", "Gamma"].map((title, position) => ({id: title, title, position, projectId:"p", status:"TODO", priority:"MEDIUM", dueDate:null, assigneeId:null, description:null})) as Task[];
it("opens a global table row with keyboard and preserves client context", async () => {
  const open=vi.fn(); render(<GlobalTaskTable tasks={tasks} membersById={{}} clientsById={{p:"Cliente"}} engagementsById={{}} showContext onOpenTask={open}/>);
  const row=screen.getAllByRole("row").find(row=>within(row).queryByText("Alpha"))!;
  await userEvent.click(within(row).getByText("Alpha"));
  expect(open).toHaveBeenCalledTimes(1); expect(open).toHaveBeenCalledWith("Alpha");
  act(() => row.focus()); await userEvent.keyboard("{Enter}"); expect(open).toHaveBeenCalledTimes(2);
});
it("preserves one toggle per checkbox press and Shift range selection", async () => {
  const toggle=vi.fn(), range=vi.fn(), open=vi.fn();
  render(<TaskList tasks={tasks} membersById={{}} onOpenTask={open} selectMode isSelected={()=>false} onToggleSelect={toggle} onSelectRange={range}/>);
  const grid=screen.getByRole("grid");
  await userEvent.click(within(grid).getByRole("checkbox",{name:"Selecionar tarefa: Alpha"}));
  expect(toggle).toHaveBeenCalledTimes(1); expect(toggle).toHaveBeenCalledWith("Alpha");
  const user=userEvent.setup(); await user.keyboard("{Shift>}"); await user.click(within(grid).getByRole("checkbox",{name:"Selecionar tarefa: Gamma"})); await user.keyboard("{/Shift}");
  expect(range).toHaveBeenCalledWith(["Alpha","Beta","Gamma"]); expect(open).not.toHaveBeenCalled();
});
it("opens a project table row and keyboard focuses selection controls", async () => {
 const open=vi.fn(); render(<TaskList tasks={tasks} membersById={{}} onOpenTask={open}/>);
 const grid=screen.getByRole("grid"); await userEvent.click(within(grid).getByText("Beta")); expect(open).toHaveBeenCalledWith("Beta");
});

const NOW = new Date("2026-11-12T15:00:00Z");
const at = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const live = deriveLiveStatus({
  state: { taskId: "Alpha", orgId: "o", version: 1, stage: "DOING", deliveryRevision: 1, responsibleId: "u1", criteria: [], context: "", executorIds: [], reviews: [], findings: [],
    summary: { objective: "x", completed: ["a", "b"], remaining: ["c", "d"], nextStep: "Rodar testes", blockers: [], references: [], updatedAt: at(3), updatedBy: "u1", channel: "MCP" },
    execution: { id: "e", agent: "Claude", ownerId: "u1", channel: "MCP", status: "RUNNING", lastUpdatedAt: at(3) } } as never,
  updatedAt: at(3), responsibleName: "Marina",
}, NOW);
const HEADERS = ["Quem", "Tarefa", "Agora", "Passos", "Último sinal", "Prazo", "Prioridade"];

it("global table has the RF27 columns and shows the live row for tasks with a workflow", () => {
  render(<TaskCardExtrasProvider value={{ live: { Alpha: live }, now: NOW }}><GlobalTaskTable tasks={tasks} membersById={{}} clientsById={{ p: "IMA" }} engagementsById={{}} showContext onOpenTask={vi.fn()} /></TaskCardExtrasProvider>);
  const grid = screen.getByRole("grid");
  expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
  const row = within(grid).getAllByRole("row").find((r) => within(r).queryByText("Alpha"))!;
  expect(within(row).getByText("Claude")).toBeInTheDocument(); // Quem: o agente
  expect(within(row).getByText("Rodando")).toBeInTheDocument(); // Agora
  expect(within(row).getByText("Rodar testes")).toBeInTheDocument();
  expect(within(row).getByRole("meter", { name: "2 de 4 passos" })).toBeInTheDocument(); // Passos
  expect(within(row).getByText("há 3 min")).toBeInTheDocument(); // Último sinal
  expect(within(row).getByText("IMA")).toBeInTheDocument(); // cliente na célula da tarefa
  const manual = within(grid).getAllByRole("row").find((r) => within(r).queryByText("Beta"))!;
  expect(within(manual).getByText("A fazer")).toBeInTheDocument(); // sem fluxo: status em texto discreto
  expect(within(manual).queryByRole("meter")).toBeNull();
});

it("project list has the same columns and keeps the selection column when selecting", () => {
  const { rerender } = render(<TaskList tasks={tasks} membersById={{}} onOpenTask={vi.fn()} />);
  expect(within(screen.getByRole("grid")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
  rerender(<TaskList tasks={tasks} membersById={{}} onOpenTask={vi.fn()} selectMode isSelected={() => false} onToggleSelect={vi.fn()} />);
  expect(within(screen.getByRole("grid")).getAllByRole("columnheader")).toHaveLength(HEADERS.length + 1);
});
