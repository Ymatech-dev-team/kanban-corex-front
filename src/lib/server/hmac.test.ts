import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { signInternalRequest } from "./hmac";

// Réplica independente do formato do backend, pra garantir que os dois batem.
function backendFormula(secret: string, body: string, ts: number) {
  return createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
}

describe("HMAC do BFF [SEC-002]", () => {
  it("bate byte-a-byte com o formato do backend (${ts}.${body})", () => {
    const ts = 1_700_000_000_000;
    const sig = signInternalRequest("segredo", '{"a":1}', ts);
    expect(sig).toBe(backendFormula("segredo", '{"a":1}', ts));
  });

  it("é determinístico e hex", () => {
    const a = signInternalRequest("s", "b", 1);
    const b = signInternalRequest("s", "b", 1);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("corpo diferente → assinatura diferente", () => {
    expect(signInternalRequest("s", "x", 1)).not.toBe(signInternalRequest("s", "y", 1));
  });
});
