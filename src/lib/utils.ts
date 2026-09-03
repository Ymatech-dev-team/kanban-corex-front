import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Helper padrão do shadcn: mescla classes condicionais + resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
