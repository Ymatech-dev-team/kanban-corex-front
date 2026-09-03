"use client";

import { useCan } from "@/lib/hooks/use-can";

/** Renderiza os filhos só se o usuário tiver a permissão. Controle sem permissão nem aparece. [design.md §9.4] */
export function Can({ permission, children }: { permission: string; children: React.ReactNode }) {
  return useCan(permission) ? <>{children}</> : null;
}
