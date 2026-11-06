"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/hooks/use-me";

/**
 * Porteiro do front: sem sessão → /login; precisa trocar senha → /first-login (inescapável);
 * senão renderiza. [design.md §2.3, JOR]
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isError) {
      router.replace("/login");
      return;
    }
    if (data?.mustChangePassword) {
      router.replace("/first-login");
    }
  }, [isLoading, isError, data, router]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando seu espaço de trabalho" className="flex min-h-screen bg-background">
        <div className="hidden w-60 shrink-0 space-y-7 border-r border-border p-6 md:block"><Skeleton className="h-7 w-24" />{[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-5 w-full" />)}</div>
        <div className="w-full space-y-7 p-6 md:p-10"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64 max-w-full" /><div className="space-y-4 rounded-xl border border-border p-5">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-12 w-full" />)}</div></div>
      </div>
    );
  }
  if (isError || data?.mustChangePassword) return null;
  return <>{children}</>;
}
