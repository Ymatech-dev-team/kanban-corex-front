"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Select inline pra usar DENTRO de um bottom sheet — expande a lista no próprio sheet (sem
 *  dropdown/portal aninhado dentro do Dialog, que brigaria por foco/z-index). [shell-mobile] */
export function SheetSelect<T extends string>({
  label,
  selected,
  options,
  onSelect,
  disabled,
  hint,
}: {
  label: string;
  selected: T | undefined;
  options: { value: T | undefined; label: string }[];
  onSelect: (v: T | undefined) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((o) => o.value === selected)?.label ?? options[0]?.label ?? "";
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {disabled && hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      {open && !disabled && (
        <div role="listbox" aria-label={label} className="max-h-52 overflow-y-auto rounded-lg border border-border bg-card">
          {options.map((o) => (
            <button
              key={o.value ?? "_all"}
              type="button"
              role="option"
              aria-selected={o.value === selected}
              onClick={() => {
                onSelect(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-2.5 text-left text-[13px] outline-none transition-colors",
                o.value === selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
