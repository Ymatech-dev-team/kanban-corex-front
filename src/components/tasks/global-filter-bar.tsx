"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { TaskPriority } from "@sistema-tasks/contracts";
import type { Member, Engagement, Project } from "@/lib/types";
import {
  type FluxoFilter,
  type GlobalFilters,
  type PrazoPreset,
  type SavedView,
  type StatusFilter,
  type TaskView,
  type ViewDef,
  DEFAULT_FILTERS,
  FLUXO_LABEL,
  FLUXO_VALUES,
  activeFacetCount,
  builtinViews,
  filtersToSearchParams,
  hasAnyFilter,
  matchView,
  readSavedViews,
  savedViewToDef,
  writeSavedViews,
} from "@/lib/global-filters";
import { FiltersControl, QueryField, SaveViewDialog, ViewTabs, type FacetDef, type QueryChip, type QuerySuggestionGroup } from "@/components/query-bar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useNarrow } from "@/components/query-bar/use-narrow";

const STATUS_OPTS: { v: StatusFilter; label: string }[] = [
  { v: "TODO", label: "A fazer" },
  { v: "DOING", label: "Fazendo" },
  { v: "DONE", label: "Feito" },
  { v: "TODAS", label: "Todas" },
];
const PRIO_OPTS: { v: TaskPriority; label: string }[] = [
  { v: "HIGH", label: "Alta" },
  { v: "MEDIUM", label: "Média" },
  { v: "LOW", label: "Baixa" },
];
const PRAZO_OPTS: { v: PrazoPreset; label: string }[] = [
  { v: "atrasadas", label: "Atrasadas" },
  { v: "hoje", label: "Hoje" },
  { v: "semana", label: "Esta semana" },
];
const label = <T extends string>(opts: { v: T; label: string }[], v: T) => opts.find((o) => o.v === v)?.label ?? v;

const VIEW_OPTS: { v: TaskView; label: string }[] = [
  { v: "kanban", label: "Quadro" },
  { v: "lista", label: "Lista" },
  { v: "calendario", label: "Calendário" },
];
const CUSTOM_VIEW_ID = "__custom";

function ViewSwitcher({ view, onView }: { view: TaskView; onView: (v: TaskView) => void }) {
  return (
    <ToggleButtonGroup
      aria-label="Visualização"
      selectionMode="single"
      disallowEmptySelection
      size="sm"
      selectedKeys={new Set([view])}
      onSelectionChange={(keys) => {
        const key = [...keys][0];
        if (key != null && key !== view) onView(String(key) as TaskView);
      }}
    >
      {VIEW_OPTS.map((o) => (
        <ToggleButton key={o.v} id={o.v} className="min-h-9 px-3 text-[12.5px] font-semibold data-[selected=true]:bg-foreground data-[selected=true]:text-background max-md:min-h-11">
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/**
 * Visões do usuário (RF24): guardadas no navegador, uma chave por usuário. Só são lidas depois que o usuário é conhecido e
 * recarregam quando ele muda; sem usuário ou com falha de storage, só as embutidas.
 */
function useSavedViews(userId: string | undefined) {
  const [saved, setSaved] = useState<SavedView[]>([]);
  useEffect(() => setSaved(readSavedViews(userId)), [userId]);
  const update = useCallback((next: SavedView[]) => {
    setSaved(next);
    writeSavedViews(userId, next);
  }, [userId]);
  return [saved, update] as const;
}

export function GlobalFilterBar({
  filters,
  onChange,
  view,
  onView,
  clients,
  engagements,
  members,
  projectoDisabled,
  respDisabled,
  countLabel,
  showOpenBoard,
  onOpenBoard,
  meId,
  activeCount: listCount,
}: {
  filters: GlobalFilters;
  onChange: (f: GlobalFilters) => void;
  view: TaskView;
  onView: (v: TaskView) => void;
  clients: Project[];
  engagements: Engagement[];
  members: Member[];
  projectoDisabled: boolean;
  respDisabled: boolean;
  countLabel: string;
  showOpenBoard: boolean;
  onOpenBoard: () => void;
  /** Usuário logado: habilita a visão "Minhas". */
  meId?: string;
  /**
   * Contagem exata da lista atual, mostrada só na aba da visão ativa (RF19). As outras abas não mostram número:
   * contagens de origens diferentes (feed, lista) nunca se misturam.
   */
  activeCount?: number;
}) {
  const set = (patch: Partial<GlobalFilters>) => onChange({ ...filters, ...patch });
  const [saved, setSaved] = useSavedViews(meId);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const narrow = useNarrow();

  const defs: ViewDef[] = useMemo(() => [...builtinViews(meId), ...saved.map(savedViewToDef)], [meId, saved]);
  // A visão ativa ignora o texto de busca: buscar dentro de "Ativas" continua em "Ativas".
  const active = matchView(defs, { ...filters, q: undefined });
  const activeId = active?.id ?? CUSTOM_VIEW_ID;
  const tabs = [
    ...defs.map((d) => ({ id: d.id, label: d.label, count: d.id === active?.id ? listCount : undefined })),
    ...(active ? [] : [{ id: CUSTOM_VIEW_ID, label: "Filtro atual" }]),
  ];

  const clientName = clients.find((c) => c.id === filters.cliente)?.name;
  const projName = engagements.find((e) => e.id === filters.projeto)?.name;
  const respName = members.find((m) => m.id === filters.resp)?.name;
  const statusApplies = view !== "kanban"; // o Quadro ignora status de propósito (as colunas são o status)

  const chips: QueryChip[] = [];
  if (filters.cliente) chips.push({ key: "cliente", label: "cliente", value: clientName ?? "…" });
  if (filters.projeto) chips.push({ key: "projeto", label: "projeto", value: projName ?? "…" });
  if (filters.resp) chips.push({ key: "resp", label: "responsável", value: respName ?? "…" });
  if (filters.fluxo) chips.push({ key: "fluxo", label: "estado", value: FLUXO_LABEL[filters.fluxo] });
  if (statusApplies && filters.status !== "ATIVAS") chips.push({ key: "status", label: "etapa", value: label(STATUS_OPTS, filters.status) });
  if (filters.prio) chips.push({ key: "prio", label: "prioridade", value: label(PRIO_OPTS, filters.prio) });
  if (filters.prazo) chips.push({ key: "prazo", label: "prazo", value: label(PRAZO_OPTS, filters.prazo) });

  function removeChip(key: string) {
    if (key === "cliente") set({ cliente: undefined, projeto: undefined });
    else if (key === "projeto") set({ projeto: undefined });
    else if (key === "resp") set({ resp: undefined });
    else if (key === "fluxo") set({ fluxo: undefined });
    else if (key === "status") set({ status: "ATIVAS" });
    else if (key === "prio") set({ prio: undefined });
    else if (key === "prazo") set({ prazo: undefined });
  }

  const groups: QuerySuggestionGroup[] = [
    { prefix: "cliente", options: clients.map((c) => ({ id: c.id, label: c.name })) },
    { prefix: "projeto", options: engagements.map((e) => ({ id: e.id, label: e.name })) },
    { prefix: "responsável", options: members.map((m) => ({ id: m.id, label: m.name })) },
    { prefix: "estado", options: FLUXO_VALUES.map((v) => ({ id: v, label: FLUXO_LABEL[v] })) },
  ];
  function pick(prefix: string, id: string) {
    if (prefix === "cliente") set({ cliente: id, projeto: undefined });
    else if (prefix === "projeto") set({ projeto: id });
    else if (prefix === "responsável") set({ resp: id });
    else if (prefix === "estado") set({ fluxo: id as FluxoFilter });
  }

  const facets: FacetDef[] = [
    { key: "cliente", label: "Cliente", value: filters.cliente, options: clients.map((c) => ({ value: c.id, label: c.name })), onChange: (v) => set({ cliente: v, projeto: undefined }) },
    {
      key: "projeto", label: "Projeto", value: filters.projeto, options: engagements.map((e) => ({ value: e.id, label: e.name })),
      onChange: (v) => set({ projeto: v }), disabled: projectoDisabled, hint: !filters.cliente ? "Selecione um cliente primeiro" : "Carregando…",
    },
    { key: "resp", label: "Responsável", value: filters.resp, options: members.map((m) => ({ value: m.id, label: m.name })), onChange: (v) => set({ resp: v }), disabled: respDisabled, hint: "Carregando…" },
    { key: "fluxo", label: "Estado do fluxo", kind: "segments", value: filters.fluxo, options: FLUXO_VALUES.map((v) => ({ value: v, label: FLUXO_LABEL[v] })), onChange: (v) => set({ fluxo: v as FluxoFilter | undefined }) },
    ...(statusApplies
      ? [{ key: "status", label: "Etapa", kind: "segments" as const, allLabel: "Ativas", value: filters.status === "ATIVAS" ? undefined : filters.status, options: STATUS_OPTS.map((o) => ({ value: o.v, label: o.label })), onChange: (v: string | undefined) => set({ status: (v as StatusFilter | undefined) ?? "ATIVAS" }) }]
      : []),
    { key: "prio", label: "Prioridade", kind: "segments", value: filters.prio, options: PRIO_OPTS.map((o) => ({ value: o.v, label: o.label })), onChange: (v) => set({ prio: v as TaskPriority | undefined }) },
    { key: "prazo", label: "Prazo", kind: "segments", allLabel: "Qualquer", value: filters.prazo, options: PRAZO_OPTS.map((o) => ({ value: o.v, label: o.label })), onChange: (v) => set({ prazo: v as PrazoPreset | undefined }) },
  ];
  // Cliente, projeto, responsável e as facetas de segmento (o texto de busca não conta).
  const activeCount = (filters.cliente ? 1 : 0) + (filters.projeto ? 1 : 0) + (filters.resp ? 1 : 0) + activeFacetCount(filters) - (!statusApplies && filters.status !== "ATIVAS" ? 1 : 0);

  const renaming = renameId ? saved.find((s) => s.id === renameId) : undefined;

  return (
    <div className="border-b border-border px-4 pb-3 pt-4 lg:px-6">
      <h1 className="m-0 text-[28px] font-extrabold tracking-[-.02em] max-md:text-2xl">Tarefas</h1>

      <ViewTabs
        className="mt-3"
        views={tabs}
        activeId={activeId}
        onSelect={(id) => {
          const def = defs.find((d) => d.id === id);
          if (def) onChange({ ...def.filters });
        }}
        onSave={meId ? () => setSaveOpen(true) : undefined}
        saveDisabled={!!active || !hasAnyFilter({ ...filters, q: undefined })}
        removableIds={saved.map((s) => s.id)}
        onRemove={(id) => setRemoveId(id)}
        onRename={(id) => setRenameId(id)}
      />

      <div className="mt-3 flex items-stretch gap-2">
        <QueryField
          value={filters.q ?? ""}
          onValueChange={(text) => set({ q: text || undefined })}
          chips={chips}
          onRemoveChip={removeChip}
          groups={groups}
          onPick={pick}
          placeholder={narrow ? "Buscar ou filtrar" : undefined}
        />
        <FiltersControl
          facets={facets}
          activeCount={activeCount}
          onClear={() => onChange({ ...DEFAULT_FILTERS, q: filters.q })}
          footer={showOpenBoard ? (
            <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1 px-2 text-[12.5px] text-muted" onClick={onOpenBoard}>
              Abrir projeto <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          ) : undefined}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
        <span aria-live="polite" className="text-muted">
          {countLabel && <b className="mono font-semibold text-foreground">{countLabel}</b>}
        </span>
        {hasAnyFilter(filters) && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[12px] text-muted max-md:min-h-11" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
            Limpar filtros
          </Button>
        )}
        {showOpenBoard && (
          <Button type="button" variant="ghost" size="sm" className="hidden h-8 gap-1 px-2 text-[12px] text-muted sm:inline-flex max-md:min-h-11" onClick={onOpenBoard}>
            Abrir projeto <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        )}
        <div className="ml-auto"><ViewSwitcher view={view} onView={onView} /></div>
      </div>

      <ConfirmDialog
        open={!!removeId}
        title="Remover visão"
        description={`Remover "${saved.find((v) => v.id === removeId)?.name ?? ""}"? Ela só existe neste navegador.`}
        confirmLabel="Remover"
        danger
        onConfirm={() => {
          if (removeId) setSaved(saved.filter((v) => v.id !== removeId));
          setRemoveId(null);
        }}
        onOpenChange={(o) => !o && setRemoveId(null)}
      />
      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        existingNames={[...builtinViews(meId).map((v) => v.label), ...saved.map((s) => s.name)]}
        onSubmit={(name) => setSaved([...saved, { id: `v${Date.now().toString(36)}`, name, params: filtersToSearchParams({ ...filters, q: undefined }).toString() }])}
      />
      <SaveViewDialog
        open={!!renaming}
        onOpenChange={(o) => !o && setRenameId(null)}
        title="Renomear visão"
        description="Escolha um novo nome para esta visão."
        initialName={renaming?.name}
        existingNames={[...builtinViews(meId).map((v) => v.label), ...saved.map((s) => s.name)]}
        onSubmit={(name) => renaming && setSaved(saved.map((s) => (s.id === renaming.id ? { ...s, name } : s)))}
      />
    </div>
  );
}
