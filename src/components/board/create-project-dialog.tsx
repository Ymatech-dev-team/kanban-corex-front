"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { createProjectSchema, type CreateProjectInput } from "@sistema-tasks/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject, useUpdateProject } from "@/lib/hooks/use-projects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
  /** Presente → modo EDIÇÃO (título "Editar cliente", PATCH). Ausente → criação. [crud-kebab] */
  project?: { id: string; name: string; description: string | null };
}

export function CreateProjectDialog({ open, onOpenChange, onCreated, project }: Props) {
  const isEdit = !!project;
  const create = useCreateProject();
  const update = useUpdateProject();
  const pending = create.isPending || update.isPending;
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: project?.name ?? "", description: project?.description ?? "" },
  });

  async function onSubmit(values: CreateProjectInput) {
    setErr(null);
    try {
      if (project) {
        await update.mutateAsync({
          id: project.id,
          patch: { name: values.name, description: values.description?.trim() || null },
        });
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync(values);
        reset();
        onOpenChange(false);
        onCreated?.(created.id);
      }
    } catch (e) {
      const ax = e as AxiosError<{ error?: { message?: string } }>;
      setErr(ax.response?.data?.error?.message ?? (isEdit ? "Não foi possível salvar o cliente." : "Não foi possível criar o cliente."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          {!isEdit && (
            <DialogDescription>Um cliente agrupa as tarefas de um atendimento ou projeto.</DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => onSubmit(v))} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pname">Nome do cliente</Label>
            <Input id="pname" autoFocus aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdesc">Descrição (opcional)</Label>
            <Input id="pdesc" maxLength={2000} {...register("description")} />
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (isEdit ? "Salvando…" : "Criando…") : isEdit ? "Salvar" : "Criar cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
