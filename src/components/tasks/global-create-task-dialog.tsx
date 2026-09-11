"use client";

import { useEffect, useState } from "react";
import type { CreateTaskInput, TaskPriority, TaskStatus } from "@sistema-tasks/contracts";
import { useProjects } from "@/lib/hooks/use-projects";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useProjectMembers } from "@/lib/hooks/use-members";
import { useCreateEngagementTask } from "@/lib/hooks/use-engagement-board";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssigneePicker } from "@/components/board/assignee-picker";
import { cn } from "@/lib/utils";

const PRIOS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
];
const STATUS_LABEL: Record<TaskStatus, string> = { TODO: "A fazer", DOING: "Fazendo", DONE: "Feito" };

function SelectRow({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: "inherit" }} // popup nativo de <option> segue o tema (claro/escuro) [review UX M3]
        className="h-9 rounded-lg border border-border bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Criar tarefa a partir da visão GLOBAL (Kanban): como não há projeto único, pede Cliente → Projeto
 * antes de criar; o status vem da coluna clicada. [tarefas-visao-global — decisão "adaptar"]
 */
export function GlobalCreateTaskDialog({
  status,
  onOpenChange,
}: {
  status: TaskStatus | null; // coluna de origem; null = fechado
  onOpenChange: (open: boolean) => void;
}) {
  const projects = useProjects();
  const [cliente, setCliente] = useState("");
  const [projeto, setProjeto] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [due, setDue] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  const engagements = useEngagements(cliente || null);
  const membersQuery = useProjectMembers(cliente || null);
  const create = useCreateEngagementTask(projeto);

  useEffect(() => {
    if (status) {
      setCliente("");
      setProjeto("");
      setTitle("");
      setPriority("MEDIUM");
      setDue("");
      setAssigneeId(null);
    }
  }, [status]);

  // trocar de cliente zera projeto/responsável (dependem do cliente)
  function pickCliente(id: string) {
    setCliente(id);
    setProjeto("");
    setAssigneeId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !status || !cliente || !projeto) return;
    const input: CreateTaskInput = {
      title: title.trim(),
      priority,
      status,
      ...(due ? { dueDate: new Date(`${due}T12:00:00`).toISOString() } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };
    try {
      await create.mutateAsync(input);
      onOpenChange(false); // só fecha no sucesso; no erro o hook já dá o toast e o dialog fica aberto
    } catch {
      /* erro sinalizado pelo onError do hook (toast); mantém os campos pra tentar de novo */
    }
  }

  const ready = !!(title.trim() && cliente && projeto);

  return (
    <Dialog open={status !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            {status ? `Entra na coluna "${STATUS_LABEL[status]}". Escolha o cliente e o projeto.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <SelectRow
              label="Cliente"
              value={cliente}
              onChange={pickCliente}
              placeholder="Escolha o cliente"
              options={projects.data ?? []}
            />
            <SelectRow
              label="Projeto"
              value={projeto}
              onChange={setProjeto}
              disabled={!cliente || engagements.isLoading}
              placeholder={cliente ? "Escolha o projeto" : "Escolha o cliente antes"}
              options={engagements.data ?? []}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gt-title">Título</Label>
            <Input id="gt-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Prioridade</Label>
            <div className="flex gap-0.5 rounded-lg border border-border bg-card p-[3px]">
              {PRIOS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    priority === p.value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gt-due">Prazo (opcional)</Label>
              <Input id="gt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Responsável (opcional)</Label>
              <AssigneePicker
                members={membersQuery.data ?? []}
                value={assigneeId}
                onChange={setAssigneeId}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!ready || create.isPending}>
              {create.isPending ? "Criando…" : "Criar tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
