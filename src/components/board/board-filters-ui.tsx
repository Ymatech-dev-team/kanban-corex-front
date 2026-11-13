"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  type BoardFilters,
  type BoardStatus,
  PRAZO_LABEL,
  PRAZO_OPTIONS,
  PRIO_LABEL,
  PRIO_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
  EMPTY_BOARD_FILTERS,
  hasAnyBoardFilter,
  hasBoardFilterExceptStatus,
  normPresetName,
} from "@/lib/board-filters";
import type { TaskPriority } from "@sistema-tasks/contracts";
import type { PrazoPreset } from "@/lib/global-filters";
import { type Preset, presetsKey, useSavePreset, useUpdatePreset, useDeletePreset } from "@/lib/hooks/use-board-filters";
import { httpStatus } from "@/lib/http-error";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FiltersControl, QueryField, ViewTabs, type FacetDef, type QueryChip, type QuerySuggestionGroup } from "@/components/query-bar";
import type { Member } from "@/lib/types";

// ---------- estado dos diálogos (vive no project-board, renderiza uma vez) ----------
export type PresetDialogState =
  | { kind: "none" }
  | { kind: "save" }
  | { kind: "rename"; preset: Preset }
  | { kind: "delete"; preset: Preset };

// ================= FAIXA DE FILTROS (visões + campo de consulta + filtros) =================

const ALL_VIEW = "__all";
const CUSTOM_VIEW = "__custom";
const NONE = "none"; // `resp: "none"` = sem responsável

/**
 * Faixa de filtros do quadro do projeto (RF19–RF21, RF24): as visões salvas no servidor (presets) como abas,
 * o campo de consulta (busca local por título + fichas das facetas) e o botão Filtros. Estado em quem usa.
 */
export function BoardFilterStrip({
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
  filters,
  onChange,
  showStatus,
  members,
  search,
  onSearchChange,
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
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
  /** Etapa (A fazer/Fazendo/Feito) só fora do Quadro (as colunas já são o status). */
  showStatus: boolean;
  members: Member[];
  search: string;
  onSearchChange: (text: string) => void;
}) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch });
  const anyFilter = showStatus ? hasAnyBoardFilter(filters) : hasBoardFilterExceptStatus(filters);
  const currentId = activeId ?? (anyFilter ? CUSTOM_VIEW : ALL_VIEW);
  const views = [
    { id: ALL_VIEW, label: "Todas" },
    ...presets.map((p) => ({ id: p.id, label: p.name })),
    ...(activeId === null && anyFilter ? [{ id: CUSTOM_VIEW, label: "Filtro atual" }] : []),
  ];

  const respName = filters.resp === NONE ? "Sem responsável" : members.find((m) => m.id === filters.resp)?.name;
  const chips: QueryChip[] = [];
  if (filters.resp !== undefined) chips.push({ key: "resp", label: "responsável", value: respName ?? "…" });
  if (showStatus && filters.status) chips.push({ key: "status", label: "etapa", value: STATUS_LABEL[filters.status] });
  if (filters.prio) chips.push({ key: "prio", label: "prioridade", value: PRIO_LABEL[filters.prio] });
  if (filters.prazo) chips.push({ key: "prazo", label: "prazo", value: PRAZO_LABEL[filters.prazo] });
  const removeChip = (key: string) => {
    if (key === "resp") set({ resp: undefined });
    else if (key === "status") set({ status: undefined });
    else if (key === "prio") set({ prio: undefined });
    else if (key === "prazo") set({ prazo: undefined });
  };

  const respOptions = [{ value: NONE, label: "Sem responsável" }, ...members.map((m) => ({ value: m.id, label: m.name }))];
  const groups: QuerySuggestionGroup[] = [
    { prefix: "responsável", options: respOptions.map((o) => ({ id: o.value, label: o.label })) },
    ...(showStatus ? [{ prefix: "etapa", options: STATUS_OPTIONS.map((s) => ({ id: s, label: STATUS_LABEL[s] })) }] : []),
    { prefix: "prioridade", options: PRIO_OPTIONS.map((p) => ({ id: p, label: PRIO_LABEL[p] })) },
    { prefix: "prazo", options: PRAZO_OPTIONS.map((p) => ({ id: p, label: PRAZO_LABEL[p] })) },
  ];
  const pick = (prefix: string, id: string) => {
    if (prefix === "responsável") set({ resp: id });
    else if (prefix === "etapa") set({ status: id as BoardStatus });
    else if (prefix === "prioridade") set({ prio: id as TaskPriority });
    else if (prefix === "prazo") set({ prazo: id as PrazoPreset });
  };

  const facets: FacetDef[] = [
    { key: "resp", label: "Responsável", value: filters.resp, options: respOptions, onChange: (v) => set({ resp: v }), disabled: members.length === 0 && filters.resp === undefined, hint: "Sem membros neste cliente" },
    ...(showStatus
      ? [{ key: "status", label: "Etapa", kind: "segments" as const, value: filters.status, options: STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] })), onChange: (v: string | undefined) => set({ status: v as BoardStatus | undefined }) }]
      : []),
    { key: "prio", label: "Prioridade", kind: "segments", value: filters.prio, options: PRIO_OPTIONS.map((p) => ({ value: p, label: PRIO_LABEL[p] })), onChange: (v) => set({ prio: v as TaskPriority | undefined }) },
    { key: "prazo", label: "Prazo", kind: "segments", allLabel: "Qualquer", value: filters.prazo, options: PRAZO_OPTIONS.map((p) => ({ value: p, label: PRAZO_LABEL[p] })), onChange: (v) => set({ prazo: v as PrazoPreset | undefined }) },
  ];
  const activeCount = chips.length;
  const presetById = (id: string) => presets.find((p) => p.id === id);

  return (
    <div className="border-b border-border px-4 pb-3 pt-1 lg:px-6">
      <ViewTabs
        ariaLabel="Visões salvas"
        views={views}
        activeId={currentId}
        onSelect={(id) => {
          if (id === ALL_VIEW) onChange(EMPTY_BOARD_FILTERS);
          else {
            const p = presetById(id);
            if (p) onApply(p);
          }
        }}
        onSave={onSave}
        saveDisabled={!canSave || activeId !== null}
        removableIds={presets.map((p) => p.id)}
        onRename={(id) => { const p = presetById(id); if (p) onRename(p); }}
        onRemove={(id) => { const p = presetById(id); if (p) onDelete(p); }}
        trailing={
          isLoading ? (
            <span role="status" className="flex items-center gap-1 px-1 text-[12px] text-muted"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Carregando visões…</span>
          ) : isError ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[12px] text-muted" onClick={onRetry}>Não foi possível carregar as visões. Tentar de novo</Button>
          ) : undefined
        }
      />
      <div className="mt-3 flex items-stretch gap-2">
        <QueryField
          value={search}
          onValueChange={onSearchChange}
          chips={chips}
          onRemoveChip={removeChip}
          groups={groups}
          onPick={pick}
          placeholder="Buscar pelo título ou digite responsável:, prazo:, prioridade:"
        />
        <FiltersControl facets={facets} activeCount={activeCount} onClear={() => onChange(EMPTY_BOARD_FILTERS)} />
      </div>
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
