/**
 * Recursos de domínio que o BFF (/api/[...path]) pode proxiar para o backend.
 * Política "negar tudo, liberar só o necessário": o 1º segmento do caminho precisa estar aqui.
 * Ao adicionar um módulo novo de rota no backend (ex.: engagements), inclua o recurso aqui —
 * senão o BFF corta com 404 antes de chamar o backend. [SEC / regressão B2]
 */
export const ALLOWED_RESOURCES = new Set([
  "me",
  "projects",
  "tasks",
  "subtasks",
  "members",
  "roles",
  "engagements",
]);

export function isAllowedResource(segment: string): boolean {
  return ALLOWED_RESOURCES.has(segment);
}
