"use client";

import { ListFilter, X } from "lucide-react";
import type { Member } from "@/lib/types";
import type { AssigneeFilter } from "@/lib/filter";
import { isFiltering } from "@/lib/filter";
import { initials } from "@/lib/initials";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function labelFor(f: AssigneeFilter, members: Member[]): string {
  if (f.type === "none") return "Sem responsável";
  if (f.type === "user") return members.find((m) => m.id === f.id)?.name ?? "Responsável";
  return "Responsável";
}

interface Props {
  members: Member[];
  value: AssigneeFilter;
  onChange: (f: AssigneeFilter) => void;
}

export function AssigneeFilter({ members, value, onChange }: Props) {
  const active = isFiltering(value);
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            active
              ? "border-muted-foreground/40 bg-accent text-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
            active && "rounded-r-none",
          )}
        >
          <ListFilter className="size-3.5" />
          {labelFor(value, members)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem active={value.type === "all"} onSelect={() => onChange({ type: "all" })}>
            Todos
          </DropdownMenuItem>
          <DropdownMenuItem active={value.type === "none"} onSelect={() => onChange({ type: "none" })}>
            Sem responsável
          </DropdownMenuItem>
          {members.map((m) => (
            <DropdownMenuItem
              key={m.id}
              active={value.type === "user" && value.id === m.id}
              onSelect={() => onChange({ type: "user", id: m.id })}
            >
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[10px] font-medium text-foreground">
                {initials(m.name)}
              </span>
              {m.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button
          type="button"
          aria-label="Limpar filtro"
          onClick={() => onChange({ type: "all" })}
          className="flex items-center rounded-r-lg border border-l-0 border-muted-foreground/40 bg-accent py-1.5 pl-1 pr-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
