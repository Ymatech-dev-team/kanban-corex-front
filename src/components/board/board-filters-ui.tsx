"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, ListFilter, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type BoardFilters,
  type BoardStatus,
  PRAZO_LABEL,
  PRAZO_OPTIONS,
  PRIO_LABEL,
  PRIO_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
  hasAnyBoardFilter,
  normPresetName,
} from "@/lib/board-filters";
import type { TaskPriority } from "@sistema-tasks/contracts";
import type { PrazoPreset } from "@/lib/global-filters";
import { type Preset, presetsKey, useSavePreset, useUpdatePreset, useDeletePreset } from "@/lib/hooks/use-board-filters";
import { httpStatus } from "@/lib/http-error";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { cn } from "@/lib/utils";

// ---------- estado dos diálogos (vive no project-board, renderiza uma vez) ----------
export type PresetDialogState =
  | { kind: "none" }
  | { kind: "save" }
  | { kind: "rename"; preset: Preset }
  | { kind: "delete"; preset: Preset };

// ================= FACETS (Status/Prioridade/Prazo) =================

export function facetCount(f: BoardFilters): number {
  return (f.status ? 1 : 0) + (f.prio ? 1 : 0) + (f.prazo ? 1 : 0);
}

const trigBase =
  "flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
const trigIdle = "border-border bg-card text-muted-foreground hover:text-foreground";
const trigActive = "border-muted-foreground/40 bg-accent text-foreground";

/** Desktop: um dropdown "Filtros" com Status (fora do Kanban) + Prioridade + Prazo. */
export function FacetsDropdown({
  filters,
  onChange,
  showStatus,
}: {
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
  showStatus: boolean;
}) {
  const n = (showStatus ? (filters.status ? 1 : 0) : 0) + (filters.prio ? 1 : 0) + (filters.prazo ? 1 : 0);
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(trigBase, n > 0 ? trigActive : trigIdle)}>
        <ListFilter className="size-3.5" aria-hidden />
        Filtros
        {n > 0 && (
          <span className="flex min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {n}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {showStatus && (
          <>
            <SectionLabel>Status</SectionLabel>
            <DropdownMenuItem active={!filters.status} onSelect={(e) => { e.preventDefault(); set({ status: undefined }); }}>
              Todos
            </DropdownMenuItem>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem key={s} active={filters.status === s} onSelect={(e) => { e.preventDefault(); set({ status: s }); }}>
                {STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <SectionLabel className={showStatus ? "mt-1 border-t border-border pt-2" : undefined}>Prioridade</SectionLabel>
        <DropdownMenuItem active={!filters.prio} onSelect={(e) => { e.preventDefault(); set({ prio: undefined }); }}>
          Todas
        </DropdownMenuItem>
        {PRIO_OPTIONS.map((p) => (
          <DropdownMenuItem key={p} active={filters.prio === p} onSelect={(e) => { e.preventDefault(); set({ prio: p }); }}>
            {PRIO_LABEL[p]}
          </DropdownMenuItem>
        ))}
        <SectionLabel className="mt-1 border-t border-border pt-2">Prazo</SectionLabel>
        <DropdownMenuItem active={!filters.prazo} onSelect={(e) => { e.preventDefault(); set({ prazo: undefined }); }}>
          Qualquer
        </DropdownMenuItem>
        {PRAZO_OPTIONS.map((p) => (
          <DropdownMenuItem key={p} active={filters.prazo === p} onSelect={(e) => { e.preventDefault(); set({ prazo: p }); }}>
            {PRAZO_LABEL[p]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-2.5 pb-1 pt-1.5 text-[10.5px] uppercase tracking-wide text-muted-foreground/70", className)}>
      {children}
    </div>
  );
}

/** Mobile (bottom sheet): grupos de pills pra Status(fora do Kanban)/Prioridade/Prazo. */
export function FacetPills({
  filters,
  onChange,
  showStatus,
}: {
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
  showStatus: boolean;
}) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch });
  return (
    <>
      {showStatus && (
        <PillGroup<BoardStatus>
          label="Status"
          selected={filters.status}
          options={[{ value: undefined, label: "Todos" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
          onSelect={(v) => set({ status: v })}
        />
      )}
      <PillGroup<TaskPriority>
        label="Prioridade"
        selected={filters.prio}
        options={[{ value: undefined, label: "Todas" }, ...PRIO_OPTIONS.map((p) => ({ value: p, label: PRIO_LABEL[p] }))]}
        onSelect={(v) => set({ prio: v })}
      />
      <PillGroup<PrazoPreset>
        label="Prazo"
        selected={filters.prazo}
        options={[{ value: undefined, label: "Qualquer" }, ...PRAZO_OPTIONS.map((p) => ({ value: p, label: PRAZO_LABEL[p] }))]}
        onSelect={(v) => set({ prazo: v })}
      />
    </>
  );
}

function PillGroup<T extends string>({
  label,
  selected,
  options,
  onSelect,
}: {
  label: string;
  selected: T | undefined;
  options: { value: T | undefined; label: string }[];
  onSelect: (v: T | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === selected;
          return (
            <button
              key={o.value ?? "_any"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(o.value)}
              className={cn(
                "flex h-10 items-center rounded-lg border px-3.5 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-muted-foreground/40 bg-accent text-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================= PRESETS =================

/** Desktop: dropdown "Presets" — aplicar / renomear / excluir / salvar filtro atual. */
export function PresetsControl({
  presets,
  isLoading,
  isError,
  activeId,
  canSave,
  onApply,
  onSave,
  onRename,
  onDelete,
  onRetry,
}: {
  presets: Preset[];
  isLoading: boolean;
  isError: boolean;
  activeId: string | null;
  canSave: boolean;
  onApply: (p: Preset) => void;
  onSave: () => void;
  onRename: (p: Preset) => void;
  onDelete: (p: Preset) => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={cn(trigBase, activeId ? trigActive : trigIdle)}>
        <Bookmark className="size-3.5" aria-hidden />
        Presets
        {presets.length > 0 && <span className="text-muted-foreground/70">{presets.length}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[248px] p-1.5">
        <SectionLabel>Presets deste cliente</SectionLabel>
        {isLoading ? (
          <div className="flex items-center gap-2 px-2.5 py-2 text-[12.5px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Carregando…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-[12.5px] text-muted-foreground">
            Não foi possível carregar.
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onRetry(); }}
              className="text-foreground underline decoration-muted-foreground/40 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Tentar de novo
            </button>
          </div>
        ) : presets.length === 0 ? (
          <div className="px-2.5 py-2 text-[12.5px] text-muted-foreground">
            Nenhum preset ainda. Monte um filtro e salve para reusar.
          </div>
        ) : (
          <div className="flex flex-col">
            {presets.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent",
                  activeId === p.id && "bg-accent",
                )}
              >
                <button
                  type="button"
                  onClick={() => { onApply(p); setOpen(false); }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
                >
                  <span className={cn("size-[6px] shrink-0 rounded-full", activeId === p.id ? "bg-primary" : "bg-muted-foreground/40")} />
                  <span className="truncate text-[13px] text-foreground" title={p.name}>{p.name}</span>
                  {activeId === p.id && <span className="shrink-0 text-[10.5px] text-primary">aplicado</span>}
                </button>
                <button
                  type="button"
                  aria-label={`Renomear ${p.name}`}
                  onClick={() => { onRename(p); setOpen(false); }}
                  className="shrink-0 text-muted-foreground opacity-0 outline-none transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${p.name}`}
                  onClick={() => { onDelete(p); setOpen(false); }}
                  className="shrink-0 text-muted-foreground opacity-0 outline-none transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-1 border-t border-border pt-1">
          <DropdownMenuItem
            disabled={!canSave}
            onSelect={(e) => { e.preventDefault(); if (canSave) { onSave(); setOpen(false); } }}
          >
            <Plus className="size-3.5" /> Salvar filtro atual
          </DropdownMenuItem>
          {!canSave && <p className="px-2.5 pb-1 text-[11px] text-muted-foreground/70">Ative um filtro para salvar.</p>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile (bottom sheet): seção de presets — lista + salvar. */
export function PresetsSheet({
  presets,
  isLoading,
  isError,
  activeId,
  canSave,
  onApply,
  onSave,
  onDelete,
  onRetry,
}: {
  presets: Preset[];
  isLoading: boolean;
  isError: boolean;
  activeId: string | null;
  canSave: boolean;
  onApply: (p: Preset) => void;
  onSave: () => void;
  onDelete: (p: Preset) => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Presets</span>
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground outline-none transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-3.5" /> Salvar filtro atual
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-1 text-[12.5px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Carregando…
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 py-1 text-[12.5px] text-muted-foreground">
          Não foi possível carregar.
          <button
            type="button"
            onClick={onRetry}
            className="text-foreground underline decoration-muted-foreground/40 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tentar de novo
          </button>
        </div>
      ) : presets.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">Nenhum preset ainda. Monte um filtro e salve para reusar.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {presets.map((p) => (
            <div
              key={p.id}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5", activeId === p.id ? "border-muted-foreground/40 bg-accent" : "border-border bg-card")}
            >
              <button type="button" onClick={() => onApply(p)} className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none">
                <span className={cn("size-[6px] shrink-0 rounded-full", activeId === p.id ? "bg-primary" : "bg-muted-foreground/40")} />
                <span className="truncate text-[13px] text-foreground">{p.name}</span>
                {activeId === p.id && <span className="shrink-0 text-[10.5px] text-primary">aplicado</span>}
              </button>
              <button
                type="button"
                aria-label={`Excluir ${p.name}`}
                onClick={() => onDelete(p)}
                className="shrink-0 text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================= DIÁLOGOS (salvar / renomear / excluir) — renderizados 1x =================

export function PresetDialogs({
  state,
  onClose,
  projectId,
  currentFilters,
  presets,
  activeId,
  onSavedApplied,
  onDeletedApplied,
}: {
  state: PresetDialogState;
  onClose: () => void;
  projectId: string;
  currentFilters: BoardFilters;
  presets: Preset[];
  activeId: string | null;
  onSavedApplied: (id: string) => void; // preset salvo/atualizado vira o aplicado
  onDeletedApplied: () => void; // excluiu o que estava aplicado → solta o vínculo
}) {
  const qc = useQueryClient();
  const save = useSavePreset(projectId);
  const update = useUpdatePreset(projectId);
  const del = useDeletePreset(projectId);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Preset | null>(null); // preset homônimo (modo "substituir?")

  // reseta o form quando abre
  useEffect(() => {
    if (state.kind === "save") { setName(""); setError(null); setConflict(null); }
    else if (state.kind === "rename") { setName(state.preset.name); setError(null); setConflict(null); }
  }, [state]);

  const findDup = (clean: string, exceptId?: string): Preset | undefined =>
    presets.find((p) => p.id !== exceptId && normPresetName(p.name) === normPresetName(clean));

  async function submitSave() {
    const clean = name.trim();
    if (!clean) { setError("Dê um nome ao preset."); return; }
    const dup = findDup(clean);
    if (dup) { setConflict(dup); return; }
    try {
      const created = await save.mutateAsync({ name: clean, filters: currentFilters });
      onSavedApplied(created.id);
      toast.success("Preset salvo");
      onClose();
    } catch (e) {
      if (httpStatus(e) === 409) {
        const dup = findDup(clean);
        if (dup) { setConflict(dup); return; }
        // 409 de uma criação concorrente que a lista local ainda não viu — recarrega e avisa.
        qc.invalidateQueries({ queryKey: presetsKey(projectId) });
        toast.error("Já existe um preset com esse nome");
        return;
      }
      toast.error("Não foi possível salvar o preset");
    }
  }

  async function overwrite() {
    if (!conflict) return;
    try {
      await update.mutateAsync({ id: conflict.id, filters: currentFilters });
      onSavedApplied(conflict.id);
      toast.success("Preset atualizado");
      onClose();
    } catch {
      toast.error("Não foi possível atualizar o preset");
    }
  }

  async function submitRename() {
    if (state.kind !== "rename") return;
    const clean = name.trim();
    if (!clean) { setError("Dê um nome ao preset."); return; }
    if (findDup(clean, state.preset.id)) { setError("Já existe um preset com esse nome."); return; }
    try {
      await update.mutateAsync({ id: state.preset.id, name: clean });
      toast.success("Preset renomeado");
      onClose();
    } catch (e) {
      if (httpStatus(e) === 409) { setError("Já existe um preset com esse nome."); return; }
      toast.error("Não foi possível renomear o preset");
    }
  }

  async function confirmDelete() {
    if (state.kind !== "delete") return;
    try {
      await del.mutateAsync(state.preset.id);
      if (activeId === state.preset.id) onDeletedApplied();
      toast.success("Preset excluído");
      onClose();
    } catch {
      toast.error("Não foi possível excluir o preset");
    }
  }

  const saving = save.isPending || update.isPending;

  return (
    <>
      {/* Salvar (com sub-modo "substituir?") */}
      <Dialog open={state.kind === "save"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          {conflict ? (
            <>
              <DialogHeader>
                <DialogTitle>Substituir preset?</DialogTitle>
                <DialogDescription>
                  Já existe <span className="text-foreground">{conflict.name}</span> neste cliente. Quer substituir os
                  filtros dele ou usar outro nome?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setConflict(null)}>Trocar o nome</Button>
                <Button type="button" disabled={saving} onClick={overwrite}>{saving ? "Aguarde…" : "Substituir"}</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Salvar filtro como preset</DialogTitle>
                <DialogDescription>Fica salvo só pra você, neste cliente.</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); submitSave(); }}
                className="flex flex-col gap-3 pt-1"
              >
                <div className="flex flex-col gap-1.5">
                  <Input
                    autoFocus
                    value={name}
                    maxLength={60}
                    placeholder="Ex.: Urgentes da semana"
                    onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
                    aria-invalid={!!error}
                    aria-describedby={error ? "preset-save-error" : undefined}
                  />
                  {error && <span id="preset-save-error" role="alert" className="text-[12px] text-destructive">{error}</span>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Renomear */}
      <Dialog open={state.kind === "rename"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear preset</DialogTitle>
            <DialogDescription>Escolha um novo nome para este preset.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitRename(); }} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-col gap-1.5">
              <Input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
                aria-invalid={!!error}
                aria-describedby={error ? "preset-rename-error" : undefined}
              />
              {error && <span id="preset-rename-error" role="alert" className="text-[12px] text-destructive">{error}</span>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={update.isPending}>{update.isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <ConfirmDialog
        open={state.kind === "delete"}
        title="Excluir preset"
        description={state.kind === "delete" ? `Excluir "${state.preset.name}"? Não dá pra desfazer.` : undefined}
        confirmLabel="Excluir"
        danger
        pending={del.isPending}
        onConfirm={confirmDelete}
        onOpenChange={(o) => !o && onClose()}
      />
    </>
  );
}

/** Só pra reexportar o helper de "tem filtro" pro board decidir o `canSave`. */
export { hasAnyBoardFilter };
