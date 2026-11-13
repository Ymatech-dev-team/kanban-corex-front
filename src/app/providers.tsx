"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toast } from "@heroui/react";
import { setApiQueryClient } from "@/lib/api";
import { is4xx } from "@/lib/http-error";

/** Providers globais do app (TanStack Query — server state). */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          // Nunca re-tentar 4xx (404/403 não somem em retry); só rede/5xx uma vez. [design detalhe-do-cliente §6]
          retry: (count, error) => (is4xx(error) ? false : count < 1),
          refetchOnWindowFocus: true, // revalida na retomada [design.md §5]
          staleTime: 30_000,
        },
      },
    });
    setApiQueryClient(qc); // liga o interceptor de 403 ao cache
    return qc;
  });
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toast.Provider placement="bottom end" className="corex-toast-region" />
    </QueryClientProvider>
  );
}
