"use client";

import { useState, type ReactNode } from "react";
import { Chip, Popover, Sheet, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNarrow } from "./use-narrow";

export interface FacetOption {
  value: string;
  label: string;
}

/** Uma faceta do painel de filtros. `value` ausente = "todos". */
export interface FacetDef {
  key: string;
  label: string;
  options: FacetOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** `select` para listas longas (cliente, projeto, responsável); `segments` para poucas opções fixas. */
  kind?: "select" | "segments";
  /** Texto da opção "sem filtro". */
  allLabel?: string;
  disabled?: boolean;
  /** Explica por que está desabilitada. */
  hint?: string;
}

const ALL = "__all__";

function FacetControl({ facet }: { facet: FacetDef }) {
  const allLabel = facet.allLabel ?? "Todos";
  if (facet.kind === "segments") {
    return (
      <div className="flex flex-col gap-1.5" role="group" aria-label={facet.label}>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{facet.label}</span>
        <ToggleButtonGroup
          aria-label={facet.label}
          selectionMode="single"
          disallowEmptySelection
          isDetached
          size="sm"
          className="flex-wrap gap-1.5"
          selectedKeys={new Set([facet.value ?? ALL])}
          onSelectionChange={(keys) => {
            const key = [...keys][0];
            facet.onChange(key == null || key === ALL ? undefined : String(key));
          }}
          isDisabled={facet.disabled}
        >
          {[{ value: ALL, label: allLabel }, ...facet.options].map((o) => (
            <ToggleButton key={o.value} id={o.value} className="min-h-9 px-3 text-[12.5px] max-md:min-h-11 data-[selected=true]:bg-foreground data-[selected=true]:text-background">
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <SimpleSelect
        label={facet.label}
        value={facet.value ?? ALL}
        options={[{ value: ALL, label: allLabel }, ...facet.options]}
        onValueChange={(v) => facet.onChange(v === ALL ? undefined : v)}
        disabled={facet.disabled}
      />
      {facet.disabled && facet.hint && <span className="text-[11px] text-muted">{facet.hint}</span>}
    </div>
  );
}

/** Corpo comum do painel (popover no desktop, folha no celular): as facetas, uma abaixo da outra. */
export function FiltersForm({ facets }: { facets: FacetDef[] }) {
  return (
    <div className="flex flex-col gap-4">
      {facets.map((f) => <FacetControl key={f.key} facet={f} />)}
    </div>
  );
}

function FiltersButtonLabel({ activeCount }: { activeCount: number }) {
  return (
    <>
      <ListFilter className="size-3.5" aria-hidden="true" />
      Filtros
      {activeCount > 0 && (
        <Chip size="sm" variant="primary" className="mono ml-0.5 min-w-4 justify-center px-1 text-[10px]" aria-label={`${activeCount} ${activeCount === 1 ? "filtro ativo" : "filtros ativos"}`}>
          {activeCount}
        </Chip>
      )}
    </>
  );
}
const triggerClass = (active: boolean) =>
  cn("h-[38px] shrink-0 gap-1.5 border border-border px-3 text-[12.5px] font-semibold", active ? "border-foreground/40 bg-surface-tertiary text-foreground" : "bg-card text-muted hover:text-foreground");

interface FiltersControlProps {
  facets: FacetDef[];
  /** Quantos filtros do painel estão ativos; aparece no botão (RF21). */
  activeCount: number;
  onClear?: () => void;
  title?: string;
  /** Conteúdo extra no rodapé do painel/folha (ex.: "Abrir projeto"). */
  footer?: ReactNode;
}

/** Desktop: botão "Filtros" que abre um popover. */
export function FiltersPopover({ facets, activeCount, onClear, title = "Filtros" }: FiltersControlProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button type="button" variant="unstyled" className={triggerClass(activeCount > 0)}>
        <FiltersButtonLabel activeCount={activeCount} />
      </Button>
      <Popover.Content placement="bottom end" offset={6} className="z-[80]">
        <Popover.Dialog aria-label={title} className="flex w-[320px] max-w-[92vw] flex-col gap-4 border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none">
          <FiltersForm facets={facets} />
          {onClear && activeCount > 0 && (
            <Button type="button" variant="ghost" size="sm" className="self-start px-2 text-[12px] text-muted max-md:min-h-11" onClick={onClear}>
              Limpar filtros
            </Button>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** Abaixo de 768 px: o mesmo painel numa folha inferior arrastável. */
export function FiltersSheet({ facets, activeCount, onClear, title = "Filtros", footer }: FiltersControlProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="unstyled" onClick={() => setOpen(true)} className={cn(triggerClass(activeCount > 0), "min-h-11")}>
        <FiltersButtonLabel activeCount={activeCount} />
      </Button>
      <Sheet isOpen={open} onOpenChange={setOpen} placement="bottom">
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog aria-label={title}>
              <Sheet.Handle />
              <Sheet.Header>
                <Sheet.Heading>{title}</Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body className="flex flex-col gap-4">
                <FiltersForm facets={facets} />
              </Sheet.Body>
              <Sheet.Footer className="flex items-center gap-3">
                {onClear && activeCount > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="min-h-11 px-2 text-[12.5px] text-muted" onClick={onClear}>
                    Limpar filtros
                  </Button>
                )}
                {footer}
                <Button type="button" variant="secondary" className="ml-auto min-h-11 px-4" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </Sheet.Footer>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </>
  );
}

/** Escolhe popover (≥ 768 px) ou folha (< 768 px). */
export function FiltersControl(props: FiltersControlProps) {
  const narrow = useNarrow();
  return narrow ? <FiltersSheet {...props} /> : <FiltersPopover {...props} />;
}
