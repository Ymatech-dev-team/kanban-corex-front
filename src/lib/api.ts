import axios from "axios";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

let queryClient: QueryClient | null = null;
export function setApiQueryClient(client: QueryClient) {
  queryClient = client;
}

// Evita toast/redirect repetidos quando várias mutações falham juntas por CSRF.
let sessionRecovering = false;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/**
 * Cliente do NAVEGADOR — fala só com o BFF do Next (/api/*, mesma origem).
 * Nunca fala direto com a API Fastify. O cookie de sessão é httpOnly (invisível ao JS);
 * o BFF injeta o Bearer + HMAC e cuida do refresh. [design.md §1.1]
 */
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// Double-submit CSRF: anexa o token do cookie legível nas mutações. [SEC-008]
api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (["post", "patch", "put", "delete"].includes(method)) {
    const csrf = readCookie("sdt_csrf");
    if (csrf) config.headers["x-csrf-token"] = csrf;
  }
  return config;
});

/** Auto-cura de sessão: avisa e manda relogar na hora (login regenera token+CSRF). Idempotente. */
function redirectToLogin() {
  if (typeof window === "undefined" || sessionRecovering || window.location.pathname.startsWith("/login")) return;
  sessionRecovering = true;
  toast.error("Sua sessão expirou. Entre novamente.");
  setTimeout(() => {
    window.location.href = "/login";
  }, 1200);
}

export function onResponseError(error: unknown) {
  const err = error as {
    response?: { status?: number; data?: { error?: { code?: string } } };
    config?: { url?: string; method?: string };
  };
  const status = err?.response?.status;
  const code = err?.response?.data?.error?.code;
  const reqPath = (err?.config?.url ?? "").split("?")[0];
  const method = (err?.config?.method ?? "get").toLowerCase();
  // Só o GET /me (poll do AuthGuard) é ignorado — ele já leva o não-logado pro login sem toast.
  // As mutações de /me (editar/excluir conta) precisam do auto-cura como qualquer outra escrita.
  const isAuthGuardPoll = reqPath === "/me" && method === "get";

  // 401 → o BFF já tentou o refresh e falhou (access E refresh mortos): a sessão acabou de verdade.
  // Sem isto, uma escrita isolada só dava toast genérico + rollback e o redirect vinha atrasado.
  // Ignora o poll do AuthGuard e /auth/* (têm erro próprio). [fix jornada-token]
  if (status === 401 && !isAuthGuardPoll && !reqPath.startsWith("/auth/")) {
    redirectToLogin();
    return Promise.reject(error);
  }

  // CSRF 403: o cookie sdt_csrf sumiu/desalinhou → nenhuma escrita passa. Não é falta de permissão:
  // avisa claro e manda relogar (o login regenera o token). Auto-cura em vez de toast genérico.
  if (status === 403 && code === "CSRF") {
    redirectToLogin();
    return Promise.reject(error);
  }

  // 403 → a permissão pode ter mudado; re-busca /me pra a UI reagir na hora. [T7.3]
  if (status === 403) {
    queryClient?.invalidateQueries({ queryKey: ["me"] });
    // canSeeCost (permissão por cliente) vive em ["project", id]: marca stale SEM refetch imediato.
    // refetchType:"none" evita loop invalidate→refetch→403 quando /clientes/[id] é aberto sem acesso;
    // a revalidação acontece no próximo remount/refocus. [review seg — detalhe-do-cliente]
    queryClient?.invalidateQueries({ queryKey: ["project"], refetchType: "none" });
    // remove (não só invalida) valores de custo: senão o RQ mostra o número velho enquanto refetcha o gate. [review seg]
    queryClient?.removeQueries({ queryKey: ["project-cost"] });
    queryClient?.removeQueries({ queryKey: ["task-cost"] });
  }
  return Promise.reject(error);
}

api.interceptors.response.use((r) => r, onResponseError);
