import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { signInternalRequest, signInternalRequestV2 } from "./hmac";

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

/**
 * Vetor de PARIDADE do v2: os MESMOS hexes existem no backend (test/hmac-v2.test.ts).
 * Se os dois passam, o BFF e a API assinam o v2 byte-a-byte — pré-requisito pra Fase 2. [hardening T5]
 */
describe("HMAC v2 do BFF — vetor de paridade", () => {
  const SECRET = "vector-secret";
  const TS = 1_700_000_000_000;
  it("vetor GET body vazio", () => {
    expect(signInternalRequestV2(SECRET, { method: "GET", path: "/tasks/mine", body: "", timestamp: TS })).toBe(
      "b5c16f12e2b339862a6fd7b5bb70a7913bd22821495f49b7fa987c32b64c7a35",
    );
  });
  it("vetor POST com body", () => {
    expect(
      signInternalRequestV2(SECRET, { method: "POST", path: "/tasks", body: '{"title":"x"}', timestamp: TS }),
    ).toBe("0fccf316c8ec5ad9b407e064481de678e1a458694f81fc60582891bbf84440b2");
  });
});
