/** Config do BFF (server-only). */
export const API_URL = process.env.API_URL ?? "http://localhost:3001";
export const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Fail-closed: sem o segredo (ou fraco), a barreira HMAC não existe — então
 * lançamos ao USAR (não no import, pra não quebrar o build). [SEC-002]
 */
export function requireInternalSecret(): string {
  const s = process.env.INTERNAL_API_SECRET;
  if (!s || s.length < 16) {
    throw new Error("INTERNAL_API_SECRET ausente ou fraco (mín. 16 chars)");
  }
  return s;
}
