"use client";

import { ChevronDown, User } from "lucide-react";
import type { Member } from "@/lib/types";
import { initials } from "@/lib/initials";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[10px] font-medium text-foreground">
      {initials(name)}
    </span>
  );
}

interface Props {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export function AssigneePicker({ members, value, onChange, disabled }: Props) {
  const current = members.find((m) => m.id === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 enabled:hover:border-muted-foreground/40",
        )}
      >
        {current ? (
          <>
            <Avatar name={current.name} />
            <span>{current.name}</span>
          </>
        ) : (
          <>
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground/60">
              <User className="size-3" />
            </span>
            <span className="text-muted-foreground">Sem responsável</span>
          </>
        )}
        <ChevronDown className="ml-1 size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        <DropdownMenuItem active={value === null} onSelect={() => onChange(null)}>
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground/60">
            <User className="size-3" />
          </span>
          Sem responsável
        </DropdownMenuItem>
        {members.map((m) => (
          <DropdownMenuItem key={m.id} active={m.id === value} onSelect={() => onChange(m.id)}>
            <Avatar name={m.name} />
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
