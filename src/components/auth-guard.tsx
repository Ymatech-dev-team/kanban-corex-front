"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (isError || data?.mustChangePassword) return null;
  return <>{children}</>;
}
