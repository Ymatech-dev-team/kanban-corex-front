import { createHmac } from "node:crypto";

/**
 * Assina a requisição interna BFF→API. DEVE bater byte-a-byte com o
 * `signInternal` do backend (`sistema de task backend/src/lib/hmac.ts`):
 * HMAC-SHA256 de `${timestamp}.${body}` em hex. [design.md §1.1, SEC-002]
 */
export function signInternalRequest(secret: string, body: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}
