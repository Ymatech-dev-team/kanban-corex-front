import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./button";
import { Input } from "./input";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "./dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./dropdown-menu";
import { SimpleSelect } from "./select";
import { ActionsMenu } from "./actions-menu";
import { Check } from "lucide-react";
import { Disclosure } from "./disclosure";

describe("HeroUI adapters — interaction contracts", () => {
  it("keeps native checkbox changes, checked state, labels and form value", async () => {
    const user=userEvent.setup();
    const changed=vi.fn();
    function Form(){const [checked,setChecked]=React.useState(false);return <form aria-label="Form"><label htmlFor="terms">Concordo</label><Input id="terms" type="checkbox" name="terms" value="yes" checked={checked} onChange={event=>{changed(event.target.checked);setChecked(event.target.checked);}}/></form>;}
    render(<Form/>);
    expect(screen.getByRole("checkbox")).toHaveAccessibleName("Concordo");
    await user.click(screen.getByRole("checkbox"));
    expect(changed).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("terms")).toBe("yes");
    await user.click(screen.getByText("Concordo"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
  it("preserves pending, disabled and button type inside forms",()=>{
    render(<form><Button aria-busy="true" disabled>Salvar</Button></form>);
    expect(screen.getByRole("button",{name:"Salvar"})).toHaveAttribute("aria-busy","true");
    expect(screen.getByRole("button",{name:"Salvar"})).toHaveAttribute("type","button");
    expect(screen.getByRole("button",{name:"Salvar"})).toBeDisabled();
  });
  it("opens a modal from its trigger and lets Escape close it",async()=>{
    const user=userEvent.setup();
    render(<Dialog><DialogTrigger>Abrir</DialogTrigger><DialogContent><DialogTitle>Editar</DialogTitle><DialogDescription>Dados</DialogDescription><Input aria-label="Nome"/></DialogContent></Dialog>);
    await user.click(screen.getByRole("button",{name:"Abrir"}));
    expect(screen.getByRole("dialog",{name:"Editar"})).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(()=>expect(screen.getByRole("button",{name:"Abrir"})).toHaveFocus());
  });
  it("respects a drawer close guard instead of dismissing dirty work",async()=>{
    const user=userEvent.setup();const close=vi.fn();
    render(<Dialog open onOpenChange={close}><DialogContent placement="right" onEscapeKeyDown={event=>event.preventDefault()}><DialogTitle>Tarefa</DialogTitle><DialogDescription>Contexto</DialogDescription><Input aria-label="Resumo"/></DialogContent></Dialog>);
    await user.click(screen.getByRole("textbox"));await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();expect(close).not.toHaveBeenCalled();
  });
  it("supports menu keyboard navigation and preventDefault for multi-selection",async()=>{
    const user=userEvent.setup();const action=vi.fn();
    render(<DropdownMenu><DropdownMenuTrigger>Filtros</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={event=>event.preventDefault()}>Manter aberto</DropdownMenuItem><DropdownMenuItem onSelect={action}>Aplicar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>);
    await user.click(screen.getByRole("button",{name:"Filtros"}));
    await user.click(screen.getByRole("menuitem",{name:"Manter aberto"}));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");expect(screen.getByRole("menuitem",{name:"Aplicar"})).toHaveFocus();
    await user.keyboard("{Enter}");expect(action).toHaveBeenCalledTimes(1);
    await waitFor(()=>expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
  it("dismisses a nested menu before consulting the drawer close guard",async()=>{
    const user=userEvent.setup();const guard=vi.fn((event:KeyboardEvent)=>event.preventDefault());
    render(<Dialog open><DialogContent onEscapeKeyDown={guard}><DialogTitle>Tarefa</DialogTitle><DialogDescription>Contexto</DialogDescription><DropdownMenu><DropdownMenuTrigger>Opções</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Editar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></DialogContent></Dialog>);
    await user.click(screen.getByRole("button",{name:"Opções"}));
    await user.keyboard("{Escape}");
    await waitFor(()=>expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog",{name:"Tarefa"})).toBeInTheDocument();
    expect(guard).not.toHaveBeenCalled();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Opções"})).toHaveFocus());
    await user.keyboard("{Escape}");expect(guard).toHaveBeenCalledTimes(1);
  });
  it("Escape cancels a nested confirmation without invoking the dirty drawer guard",async()=>{
    const user=userEvent.setup();const guard=vi.fn((event:KeyboardEvent)=>event.preventDefault());
    function View(){const [confirm,setConfirm]=React.useState(false);return <Dialog open><DialogContent onEscapeKeyDown={guard}><DialogTitle>Detalhes da tarefa</DialogTitle><DialogDescription>Contexto</DialogDescription><Button onClick={()=>setConfirm(true)}>Voltar</Button><Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogTitle>Descartar alterações?</DialogTitle><DialogDescription>Mudanças não salvas</DialogDescription><Button>Continuar editando</Button></DialogContent></Dialog></DialogContent></Dialog>;}
    render(<View/>);await user.click(screen.getByRole("button",{name:"Voltar"}));
    expect(screen.getByRole("dialog",{name:"Descartar alterações?"})).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Descartar alterações?"})).not.toBeInTheDocument());
    expect(screen.getByRole("dialog",{name:"Detalhes da tarefa"})).toBeInTheDocument();expect(guard).not.toHaveBeenCalled();
  });
  it("opens an actions menu once on pointer click without triggering its card",async()=>{
    const user=userEvent.setup();const card=vi.fn();const action=vi.fn();
    render(<div onClick={card}><ActionsMenu label="Ações" items={[{key:"edit",label:"Editar",icon:Check,onSelect:action}]}/></div>);
    await user.click(screen.getByRole("button",{name:"Ações"}));
    await user.click(screen.getByRole("menuitem",{name:"Editar"}));
    expect(action).toHaveBeenCalledTimes(1);expect(card).not.toHaveBeenCalled();
  });
  it("selects an option and reports the actual value",async()=>{
    const user=userEvent.setup();const change=vi.fn();
    render(<SimpleSelect label="Status" value="" onValueChange={change} options={[{value:"",label:"Todos"},{value:"done",label:"Concluído"}]}/>);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option",{name:"Concluído"}));
    expect(change).toHaveBeenCalledWith("done");
  });
  it("notifies the caller when disclosure is expanded",async()=>{
    const change=vi.fn();render(<Disclosure title="Histórico" onOpenChange={change}>Eventos</Disclosure>);
    fireEvent.click(screen.getByRole("button",{name:/Histórico/}));
    expect(change).toHaveBeenCalledWith(true);
  });
});
