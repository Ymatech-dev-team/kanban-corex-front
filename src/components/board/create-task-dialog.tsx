"use client";

import { useEffect, useState } from "react";
import type { CreateTaskInput, TaskPriority, TaskStatus } from "@sistema-tasks/contracts";
import type { Member } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssigneePicker } from "./assignee-picker";
import { useCreateTask } from "@/lib/hooks/use-tasks";
import { parseHoursToMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";

const PRIOS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
];

const STATUS_LABEL: Record<TaskStatus, string> = { TODO: "A fazer", DOING: "Fazendo", DONE: "Feito" };

interface Props {
  projectId: string;
  status: TaskStatus | null; // coluna de origem; null = fechado
  members: Member[];
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ projectId, status, members, onOpenChange }: Props) {
  const create = useCreateTask(projectId);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [due, setDue] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [estimated, setEstimated] = useState("");

  useEffect(() => {
    if (status) {
      setTitle("");
      setPriority("MEDIUM");
      setDue("");
      setAssigneeId(null);
      setEstimated("");
    }
  }, [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !status) return;
    const input: CreateTaskInput = {
      title: title.trim(),
      priority,
      status,
      ...(due ? { dueDate: new Date(`${due}T12:00:00`).toISOString() } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...((): { estimatedMinutes?: number } => {
        const m = parseHoursToMinutes(estimated);
        return m != null ? { estimatedMinutes: m } : {};
      })(),
    };
    await create.mutateAsync(input);
    onOpenChange(false);
  }

  return (
    <Dialog open={status !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>{status ? `Entra na coluna "${STATUS_LABEL[status]}".` : ""}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ttitle">Título</Label>
            <Input id="ttitle" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
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
              <Label htmlFor="tdue">Prazo (opcional)</Label>
              <Input id="tdue" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="test">Horas estimadas</Label>
              <Input
                id="test"
                inputMode="decimal"
                placeholder="ex.: 8 ou 1,5"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Responsável (opcional)</Label>
            <AssigneePicker members={members} value={assigneeId} onChange={setAssigneeId} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? "Criando…" : "Criar tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
