import { createHash, createHmac } from "node:crypto";

/**
 * Assina a requisição interna BFF→API. DEVE bater byte-a-byte com o
 * `signInternal` do backend (`sistema de task backend/src/lib/hmac.ts`):
 * HMAC-SHA256 de `${timestamp}.${body}` em hex. [design.md §1.1, SEC-002]
 */
export function signInternalRequest(secret: string, body: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Assinatura v2 (T5): amarra MÉTODO + PATH (sem query) + hash do body. DEVE bater byte-a-byte com o
 * `signInternalV2` do backend. Path SEM query (a query normaliza diferente entre fetch/edge e o backend).
 * Fase 1: enviada em paralelo (header `x-internal-sig-v2`) só pra medir; a auth ainda usa a antiga. [hardening T5]
 */
export function signInternalRequestV2(
  secret: string,
  input: { method: string; path: string; body: string; timestamp: number },
): string {
  const bodyHash = createHash("sha256").update(input.body).digest("hex");
  const canonical = `${input.timestamp}\n${input.method.toUpperCase()}\n${input.path}\n${bodyHash}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
}
