/** Id determinístico do "Projeto geral" de um cliente (mesma convenção do backend). [hierarquia-projetos] */
export function generalEngagementId(clientId: string): string {
  return `gen-${clientId}`;
}
