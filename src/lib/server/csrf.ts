import { timingSafeEqual } from "node:crypto";
import { getCsrfCookie } from "./session";

/** Double-submit: header x-csrf-token deve bater com o cookie sdt_csrf. [SEC-008] */
export function csrfMatches(header: string | null, cookie: string | undefined): boolean {
  if (!header || !cookie) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(cookie);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function assertCsrf(req: Request): Promise<boolean> {
  return csrfMatches(req.headers.get("x-csrf-token"), await getCsrfCookie());
}
