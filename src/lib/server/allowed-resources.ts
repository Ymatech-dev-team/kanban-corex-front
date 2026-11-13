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
  "notifications",
  "mcp",
]);

export function isAllowedResource(segment: string): boolean {
  return ALLOWED_RESOURCES.has(segment);
}

/**
 * Rotas somente de leitura dentro de um recurso já liberado. `tasks/workflows/team` (feed da equipe, RB1)
 * só aceita GET/HEAD: nenhuma mutação existe nesse caminho e o BFF não deve repassar uma.
 */
const READ_ONLY_PATHS = ["tasks/workflows/team"];

export function isAllowedRoute(method: string, segments: string[]): boolean {
  if (segments.length === 0 || !isAllowedResource(segments[0])) return false;
  const path = segments.join("/");
  const readOnly = READ_ONLY_PATHS.some(p => path === p || path.startsWith(p + "/"));
  return !readOnly || method === "GET" || method === "HEAD";
}
