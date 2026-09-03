import { callApi, type ApiResult } from "./api";

/**
 * Single-flight de refresh: chamadas concorrentes com o mesmo refresh token
 * disparam UMA renovação só (evita 2 abas revogarem a família uma da outra). [JOR-3c]
 * Complemento à janela de graça do backend (que cobre o caso multi-instância).
 */
const inFlight = new Map<string, Promise<ApiResult>>();

export function refreshSession(refreshToken: string): Promise<ApiResult> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;
  const p = callApi("POST", "/auth/refresh", { body: { refreshToken } }).finally(() => {
    inFlight.delete(refreshToken);
  });
  inFlight.set(refreshToken, p);
  return p;
}
