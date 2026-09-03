"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface Pending {
  projectId: string;
  taskId?: string;
}

interface BoardNav {
  pending: Pending | null;
  request: (projectId: string, taskId?: string) => void;
  consume: () => void;
}

const Ctx = createContext<BoardNav | null>(null);

/** Ponte para o board: pede pra abrir um cliente (e opcionalmente uma tarefa); o board aplica e consome. */
export function BoardNavProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const request = useCallback((projectId: string, taskId?: string) => setPending({ projectId, taskId }), []);
  const consume = useCallback(() => setPending(null), []);
  const value = useMemo(() => ({ pending, request, consume }), [pending, request, consume]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoardNav(): BoardNav {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoardNav fora do BoardNavProvider");
  return ctx;
}
