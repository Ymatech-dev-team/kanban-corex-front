import type { AxiosError } from "axios";

/** Status HTTP de um erro do axios (undefined se for erro de rede/sem resposta). */
export function httpStatus(e: unknown): number | undefined {
  return (e as AxiosError)?.response?.status;
}

/** true para 4xx (erro do cliente — não adianta re-tentar). */
export function is4xx(e: unknown): boolean {
  const s = httpStatus(e);
  return s !== undefined && s >= 400 && s < 500;
}
