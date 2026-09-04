/** Formata centavos como moeda BRL (ex.: 250000 → "R$ 2.500,00"). */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Rótulo curto de remuneração (ex.: "R$ 2.500,00/mês" ou "R$ 40,00/h"). null se não definida. */
export function compensationLabel(type: string | null, cents: number | null): string | null {
  if (!type || cents == null) return null;
  const value = formatBRL(cents);
  return type === "MONTHLY" ? `${value}/mês` : `${value}/h`;
}

/** "2.500,50" ou "2500.50" ou "2500" → centavos (250050). null se inválido/vazio. */
export function parseReaisToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s|R\$/g, "");
  if (!cleaned) return null;
  // aceita vírgula OU ponto como decimal; remove separador de milhar
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
