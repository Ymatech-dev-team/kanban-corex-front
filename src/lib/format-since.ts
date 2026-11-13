/**
 * Tempo relativo e relógio em BRT (UTC-3, sem horário de verão desde 2019).
 * Aritmética de offset fixo em vez de Intl.timeZone: igual no servidor, no navegador e nos testes.
 */
const BRT_OFFSET_MS = -3 * 3_600_000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

/** Data "de parede" em BRT: lê com os getters UTC. */
const toBrt = (ms: number) => new Date(ms + BRT_OFFSET_MS);
const dayNumber = (brt: Date) => Math.floor(brt.getTime() / 86_400_000);

/** "HH:MM" em BRT; "—" para data inválida. */
export function formatClock(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const d = toBrt(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "agora" · "há N min" · "há N h" · "ontem HH:MM" · "DD mmm". Dia decidido em BRT. */
export function formatSince(iso: string, now: Date): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const diff = now.getTime() - ms;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  const then = toBrt(ms);
  const today = dayNumber(toBrt(now.getTime()));
  const gap = today - dayNumber(then);
  if (gap <= 0) return `há ${Math.floor(diff / 3_600_000)} h`;
  if (gap === 1) return `ontem ${pad(then.getUTCHours())}:${pad(then.getUTCMinutes())}`;
  return `${pad(then.getUTCDate())} ${MONTHS[then.getUTCMonth()]}`;
}
