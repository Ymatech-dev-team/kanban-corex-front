"use client";

import { ChevronDown, ChevronRight, ListFilter, X } from "lucide-react";
import type { TaskPriority } from "@sistema-tasks/contracts";
import type { Member, Engagement, Project } from "@/lib/types";
import {
  type GlobalFilters,
  type StatusFilter,
  type PrazoPreset,
  type TaskView,
  activeFacetCount,
  hasAnyFilter,
  DEFAULT_FILTERS,
} from "@/lib/global-filters";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const STATUS_OPTS: { v: StatusFilter; label: string }[] = [
  { v: "ATIVAS", label: "Ativas" },
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
const STATUS_LABEL = (s: StatusFilter) => STATUS_OPTS.find((o) => o.v === s)?.label ?? s;
const PRIO_LABEL = (p: TaskPriority) => PRIO_OPTS.find((o) => o.v === p)?.label ?? p;
const PRAZO_LABEL = (p: PrazoPreset) => PRAZO_OPTS.find((o) => o.v === p)?.label ?? p;

const trigBase =
  "flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const trigIdle = "border-border bg-card text-muted-foreground hover:text-foreground";
const trigActive = "border-muted-foreground/40 bg-accent text-foreground";

/** Facet inline (Cliente/Projeto/Responsável): dropdown-botão + X pra limpar. Estado ativo por rótulo+X, não só cor. */
function Facet({
  label,
  valueLabel,
  active,
  disabled,
  onClear,
  children,
}: {
  label: string;
  valueLabel: string;
  active: boolean;
  disabled?: boolean;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger disabled={disabled} className={cn(trigBase, active ? trigActive : trigIdle, active && "rounded-r-none")}>
          <span className="text-muted-foreground">{label}:</span>
          <span className="max-w-[10rem] truncate">{valueLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && onClear && (
        <button
          type="button"
          aria-label={`Limpar ${label}`}
          onClick={onClear}
          className="flex h-9 items-center rounded-r-lg border border-l-0 border-muted-foreground/40 bg-accent pl-1 pr-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Chip({ k, v, onRemove }: { k: string; v: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2.5 pr-1 text-[11.5px]">
      <span className="text-muted-foreground">{k}:</span>
      {v}
      <button
        type="button"
        aria-label={`Remover filtro ${k}`}
        onClick={onRemove}
        className="flex size-[15px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

const VIEW_OPTS: { v: TaskView; label: string }[] = [
  { v: "kanban", label: "Kanban" },
  { v: "lista", label: "Lista" },
  { v: "calendario", label: "Calendário" },
];

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
}) {
  const set = (patch: Partial<GlobalFilters>) => onChange({ ...filters, ...patch });
  const facets = activeFacetCount(filters);

  const clientName = clients.find((c) => c.id === filters.cliente)?.name;
  const projName = engagements.find((e) => e.id === filters.projeto)?.name;
  const respName = members.find((m) => m.id === filters.resp)?.name;

  return (
    <div className="flex flex-col gap-2 border-b border-border px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Seletor de visualização — extrema-esquerda, igual às tabs do board. [design] */}
        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-card p-1 text-[12.5px]">
          {VIEW_OPTS.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => onView(o.v)}
              aria-current={view === o.v ? "page" : undefined}
              className={cn(
                "flex h-full items-center rounded-md px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                view === o.v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <h1 className="mr-1 text-base font-medium tracking-tight">Tarefas</h1>

        {/* Cliente — trocar zera Projeto (que pertence ao cliente); Responsável é global, permanece. [RF-C7] */}
        <Facet
          label="Cliente"
          valueLabel={clientName ?? "Todos"}
          active={!!filters.cliente}
          onClear={() => set({ cliente: undefined, projeto: undefined })}
        >
          <DropdownMenuItem active={!filters.cliente} onSelect={() => set({ cliente: undefined, projeto: undefined })}>
            Todos
          </DropdownMenuItem>
          {clients.map((c) => (
            <DropdownMenuItem
              key={c.id}
              active={c.id === filters.cliente}
              onSelect={() => set({ cliente: c.id, projeto: undefined })}
            >
              {c.name}
            </DropdownMenuItem>
          ))}
        </Facet>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />

        <Facet
          label="Projeto"
          valueLabel={projName ?? "Todos"}
          active={!!filters.projeto}
          disabled={projectoDisabled}
          onClear={() => set({ projeto: undefined })}
        >
          <DropdownMenuItem active={!filters.projeto} onSelect={() => set({ projeto: undefined })}>
            Todos
          </DropdownMenuItem>
          {engagements.map((e) => (
            <DropdownMenuItem key={e.id} active={e.id === filters.projeto} onSelect={() => set({ projeto: e.id })}>
              {e.name}
            </DropdownMenuItem>
          ))}
        </Facet>

        <Facet
          label="Responsável"
          valueLabel={respName ?? "Todos"}
          active={!!filters.resp}
          disabled={respDisabled}
          onClear={() => set({ resp: undefined })}
        >
          <DropdownMenuItem active={!filters.resp} onSelect={() => set({ resp: undefined })}>
            Todos
          </DropdownMenuItem>
          {members.map((m) => (
            <DropdownMenuItem key={m.id} active={m.id === filters.resp} onSelect={() => set({ resp: m.id })}>
              {m.name}
            </DropdownMenuItem>
          ))}
        </Facet>

        {/* Filtros (Status/Prioridade/Prazo) — mantém o menu aberto ao escolher (preventDefault). */}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(trigBase, facets > 0 ? trigActive : trigIdle)}>
            <ListFilter className="size-3.5" aria-hidden />
            Filtros
            {facets > 0 && (
              <span className="flex min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {facets}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] uppercase tracking-wide text-muted-foreground/70">Status</div>
            {STATUS_OPTS.map((o) => (
              <DropdownMenuItem key={o.v} active={filters.status === o.v} onSelect={(e) => { e.preventDefault(); set({ status: o.v }); }}>
                {o.label}
              </DropdownMenuItem>
            ))}
            <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2 text-[10.5px] uppercase tracking-wide text-muted-foreground/70">Prioridade</div>
            <DropdownMenuItem active={!filters.prio} onSelect={(e) => { e.preventDefault(); set({ prio: undefined }); }}>Todas</DropdownMenuItem>
            {PRIO_OPTS.map((o) => (
              <DropdownMenuItem key={o.v} active={filters.prio === o.v} onSelect={(e) => { e.preventDefault(); set({ prio: o.v }); }}>
                {o.label}
              </DropdownMenuItem>
            ))}
            <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2 text-[10.5px] uppercase tracking-wide text-muted-foreground/70">Prazo</div>
            <DropdownMenuItem active={!filters.prazo} onSelect={(e) => { e.preventDefault(); set({ prazo: undefined }); }}>Qualquer</DropdownMenuItem>
            {PRAZO_OPTS.map((o) => (
              <DropdownMenuItem key={o.v} active={filters.prazo === o.v} onSelect={(e) => { e.preventDefault(); set({ prazo: o.v }); }}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11.5px] text-muted-foreground" aria-live="polite">{countLabel}</span>
          {showOpenBoard && (
            <button
              type="button"
              onClick={onOpenBoard}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Abrir projeto
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Chips dos facets do popover + limpar tudo (só quando há filtro) */}
      {(facets > 0 || hasAnyFilter(filters)) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.status !== "ATIVAS" && <Chip k="Status" v={STATUS_LABEL(filters.status)} onRemove={() => set({ status: "ATIVAS" })} />}
          {filters.prio && <Chip k="Prioridade" v={PRIO_LABEL(filters.prio)} onRemove={() => set({ prio: undefined })} />}
          {filters.prazo && <Chip k="Prazo" v={PRAZO_LABEL(filters.prazo)} onRemove={() => set({ prazo: undefined })} />}
          {hasAnyFilter(filters) && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS })}
              className="text-[11.5px] text-muted-foreground underline decoration-muted-foreground/40 underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
