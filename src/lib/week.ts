/** Semana de segunda a domingo contendo `d`. */
export function startOfWeekMonday(d: Date): Date {
  const daysSinceMonday = (d.getDay() + 6) % 7; // domingo(0)→6, segunda(1)→0, ...
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday);
}

/** Os 7 dias (segunda→domingo) da semana de `d`. */
export function weekDaysMonday(d: Date): Date[] {
  const s = startOfWeekMonday(d);
  return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
}
