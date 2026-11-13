"use client";

import { Chip, Tabs } from "@heroui/react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ViewTabItem {
  id: string;
  label: string;
  /** Contagem, quando conhecida (RF19). */
  count?: number;
}

/**
 * Visões como abas planas sublinhadas (RF19): as embutidas, as salvas e "+ Salvar visão".
 * Apresentação pura. `activeId` precisa existir em `views`; quando os filtros atuais não batem com nenhuma visão,
 * quem usa inclui uma aba "Filtro atual" (assim sempre há uma aba selecionada).
 */
export function ViewTabs({
  views,
  activeId,
  onSelect,
  onSave,
  saveDisabled = false,
  removableIds = [],
  onRemove,
  onRename,
  ariaLabel = "Visões",
  trailing,
  className,
}: {
  views: ViewTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Mostra "+ Salvar visão". */
  onSave?: () => void;
  saveDisabled?: boolean;
  /** Visões do usuário: a ativa pode ser removida/renomeada. */
  removableIds?: string[];
  onRemove?: (id: string) => void;
  onRename?: (id: string) => void;
  ariaLabel?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  const manageable = removableIds.includes(activeId);
  return (
    <div className={cn("flex min-w-0 items-end gap-3 border-b border-border", className)}>
      <Tabs
        variant="secondary"
        selectedKey={activeId}
        onSelectionChange={(key) => {
          if (String(key) !== activeId) onSelect(String(key));
        }}
        className="min-w-0 flex-1"
      >
        <Tabs.ListContainer className="overflow-x-auto bg-transparent">
          <Tabs.List aria-label={ariaLabel} className="w-max justify-start gap-5">
            {views.map((view) => (
              <Tabs.Tab key={view.id} id={view.id} className="w-auto flex-none whitespace-nowrap px-0.5 py-2.5 text-[13px] font-semibold max-md:min-h-11">
                {view.label}
                {view.count != null && (
                  <Chip size="sm" variant="soft" className="mono ml-1.5 bg-transparent p-0 text-[11px] font-normal text-muted">
                    {view.count}
                  </Chip>
                )}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div className="flex shrink-0 items-center gap-1 pb-1.5">
        {manageable && onRename && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[12px] text-muted max-md:min-h-11" onClick={() => onRename(activeId)}>
            Renomear
          </Button>
        )}
        {manageable && onRemove && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[12px] text-muted max-md:min-h-11" onClick={() => onRemove(activeId)}>
            Remover visão
          </Button>
        )}
        {onSave && (
          <Button type="button" variant="ghost" size="sm" disabled={saveDisabled} onClick={onSave} className="h-8 gap-1 px-2 text-[12px] font-semibold text-muted max-md:min-h-11">
            <Plus className="size-3.5" aria-hidden="true" /> Salvar visão
          </Button>
        )}
        {trailing}
      </div>
    </div>
  );
}
