/** Nome de uma cópia: "X" → "X (cópia)", "X (cópia)" → "X (cópia 2)", etc. Respeita o limite. [crud-kebab] */
export function copyName(name: string, max = 200): string {
  const m = name.match(/^(.*?)\s*\(cópia(?:\s+(\d+))?\)\s*$/);
  const base = m ? m[1] : name;
  const n = m ? (m[2] ? parseInt(m[2], 10) + 1 : 2) : 1;
  const suffix = n === 1 ? " (cópia)" : ` (cópia ${n})`;
  const room = Math.max(0, max - suffix.length);
  return base.slice(0, room).trimEnd() + suffix;
}
