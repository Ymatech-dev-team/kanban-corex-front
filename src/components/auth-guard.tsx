"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { httpStatus } from "@/lib/http-error";
import { useMe } from "@/lib/hooks/use-me";

/**
 * Porteiro do front: sem sessão → /login; precisa trocar senha → /first-login (inescapável);
 * senão renderiza. [design.md §2.3, JOR]
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError, error, refetch } = useMe();
  const status = httpStatus(error);
  const unauthorized = isError && status === 401;
  const code = (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
  const transient = status === undefined || status === 429 || (status >= 500 && status <= 599) || (status === 409 && code === "REFRESH_EM_ANDAMENTO");
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (unauthorized) {
      router.replace("/login");
      return;
    }
    if (data?.mustChangePassword) {
      router.replace("/first-login");
    }
  }, [isLoading, unauthorized, data, router]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando seu espaço de trabalho" className="flex min-h-screen bg-background">
        <div className="hidden w-60 shrink-0 space-y-7 border-r border-border p-6 md:block"><Skeleton className="h-7 w-24" />{[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-5 w-full" />)}</div>
        <div className="w-full space-y-7 p-6 md:p-10"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64 max-w-full" /><div className="space-y-4 rounded-xl border border-border p-5">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-12 w-full" />)}</div></div>
      </div>
    );
  }
  if (unauthorized || data?.mustChangePassword) return null;
  if (isError && (!data || !transient)) return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6"><p>{transient ? "Não foi possível verificar sua sessão agora. Sua conexão pode estar temporariamente indisponível." : "Não foi possível acessar este espaço. Verifique seu acesso e tente novamente."}</p><Button onClick={() => refetch()}>Tentar novamente</Button></div>;
  return <>{children}</>;
}
