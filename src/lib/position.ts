/**
 * Posição fracionária para reordenar sem tocar nos vizinhos.
 * `position` é DOUBLE no banco, então o ponto-médio entre dois cards
 * sempre cabe. O servidor é a fonte da verdade (reconcilia no onSettled).
 */
export function midpoint(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

/**
 * Calcula a posição de destino ao soltar um card numa coluna já ordenada
 * (ascendente) que NÃO contém o card arrastado. `index` é o slot destino
 * (0 = topo, length = fim).
 */
export function positionForIndex(ordered: number[], index: number): number {
  const before = index > 0 ? ordered[index - 1] : null;
  const after = index < ordered.length ? ordered[index] : null;
  return midpoint(before ?? null, after ?? null);
}
