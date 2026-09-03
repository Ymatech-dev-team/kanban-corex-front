import axios from "axios";
import type { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;
export function setApiQueryClient(client: QueryClient) {
  queryClient = client;
}

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

// 403 → a permissão pode ter mudado; re-busca /me pra a UI reagir na hora. [T7.3]
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 403) {
      queryClient?.invalidateQueries({ queryKey: ["me"] });
    }
    return Promise.reject(error);
  },
);
