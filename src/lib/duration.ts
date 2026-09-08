/** Horas (aceita vírgula OU ponto) → minutos inteiros. null se vazio/ inválido. Ex.: "1,5" → 90. */
export function parseHoursToMinutes(input: string): number | null {
  const cleaned = input.trim().replace(/\s|h/gi, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const hours = Number(normalized);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 60);
}

/** Minutos → horas para preencher o input (ex.: 90 → "1,5"). "" se null. */
export function minutesToHoursInput(min: number | null | undefined): string {
  if (min == null) return "";
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : String(h).replace(".", ",");
}

/** Minutos → rótulo de exibição (ex.: 90 → "1h 30min", 120 → "2h", 45 → "45min"). */
export function formatMinutesAsHours(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
