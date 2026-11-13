import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TaskList } from "./task-list";
import { GlobalTaskTable } from "../tasks/global-task-table";
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
