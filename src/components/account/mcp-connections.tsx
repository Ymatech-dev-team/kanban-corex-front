"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { httpStatus } from "@/lib/http-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
interface Connection { id: string; clientId: string; scopes: string[]; expiresAt: number; revokedAt: number | null }
const key = ["mcp-connections"] as const;
const scopeLabels: Record<string, string> = { "projects:read": "Consultar projetos", "tasks:read": "Consultar tarefas", "tasks:create": "Criar tarefas", "tasks:update": "Atualizar tarefas", "workflow:read": "Consultar fluxo", "workflow:write": "Atualizar fluxo" };
export function McpConnections() {
  const cache = useQueryClient();
  const [selected, setSelected] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  const query = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ connections: Connection[] }>("/mcp/connections")).data.connections });
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/mcp/connections/${encodeURIComponent(id)}`), retry: false });
  async function confirm() {
    if (!selected || locked.current) return;
    locked.current = true; setError(null);
    try {
      await revoke.mutateAsync(selected.id);
      cache.setQueryData<Connection[]>(key, (current) => current?.map((item) => item.id === selected.id ? { ...item, revokedAt: Date.now() / 1000 } : item));
      setSelected(null); setNotice("Conexão revogada. O assistente perdeu o acesso ao painel.");
      await cache.invalidateQueries({ queryKey: key });
    } catch { setError("Não foi possível confirmar a revogação. Tente novamente."); }
    finally { locked.current = false; }
  }
  if (query.isError && httpStatus(query.error) === 404) return null;
  return <section aria-labelledby="mcp-connections-title" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2"><Cable className="size-4 text-primary" aria-hidden="true" /><h2 id="mcp-connections-title" className="text-sm font-medium">Conexões Claude</h2></div><p className="text-xs text-muted-foreground">Gerencie os assistentes autorizados a acessar o Kanban com suas permissões.</p>
    {query.isLoading ? <div role="status" aria-label="Carregando conexões"><Skeleton className="h-16 w-full" /></div> : query.isError ? <div role="alert" className="space-y-2"><p className="text-sm text-muted-foreground">Não foi possível consultar suas conexões.</p><Button size="sm" variant="secondary" disabled={query.isFetching} onClick={() => query.refetch()}>Tentar novamente</Button></div> : !query.data?.length ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />Nenhum assistente conectado à sua conta.</p> : <ul className="divide-y divide-border">{query.data.map((connection) => {
      const expired = connection.expiresAt * 1000 <= Date.now();
      const inactive = connection.revokedAt !== null || expired;
      return <li key={connection.id} className="flex flex-wrap items-start justify-between gap-3 py-3"><div className="min-w-0 flex-1 space-y-1"><p className="break-all text-sm font-medium">{connection.clientId}</p><p className="text-xs text-muted-foreground">{connection.revokedAt !== null ? "Revogada" : expired ? "Expirada" : `Ativa até ${new Date(connection.expiresAt * 1000).toLocaleString("pt-BR")}`}</p><p className="break-words text-xs text-muted-foreground">{connection.scopes.map((scope) => scopeLabels[scope] ?? scope).join(" · ")}</p></div>{!inactive && <Button size="sm" variant="secondary" onClick={() => { setSelected(connection); setError(null); setNotice(""); }}>Revogar</Button>}</li>;
    })}</ul>}
    {notice && <p role="status" className="text-xs text-primary">{notice}</p>}
    <ConfirmDialog open={!!selected && !query.isError} title="Revogar conexão?" description={<><span>O assistente {selected?.clientId} perderá acesso às suas tarefas. Para voltar a usar, será necessário autorizar uma nova conexão.</span>{error && <span role="alert" className="mt-2 block text-destructive">{error}</span>}</>} confirmLabel="Revogar conexão" pendingLabel="Revogando…" pending={revoke.isPending} onConfirm={confirm} onOpenChange={(open) => { if (!open && !locked.current) setSelected(null); }} />
  </section>;
}
