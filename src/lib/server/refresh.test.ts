import { describe, it, expect, vi, beforeAll } from "vitest";
import { refreshSession } from "./refresh";

beforeAll(() => {
  process.env.INTERNAL_API_SECRET = "test-internal-secret-min16";
});

function mockFetch(counter: { n: number }) {
  return vi.fn(async () => {
    counter.n++;
    await new Promise((r) => setTimeout(r, 15));
    return { status: 200, json: async () => ({ accessToken: "a", refreshToken: "r" }) } as unknown as Response;
  });
}

describe("refresh single-flight [JOR-3c]", () => {
  it("2 chamadas concorrentes com o mesmo token → 1 fetch só", async () => {
    const c = { n: 0 };
    vi.stubGlobal("fetch", mockFetch(c));
    const [a, b] = await Promise.all([refreshSession("rt"), refreshSession("rt")]);
    expect(c.n).toBe(1);
    expect(a).toBe(b); // mesma promise compartilhada
    expect((a.data as { accessToken: string }).accessToken).toBe("a");
  });

  it("tokens diferentes → 2 fetch", async () => {
    const c = { n: 0 };
    vi.stubGlobal("fetch", mockFetch(c));
    await Promise.all([refreshSession("rt-x"), refreshSession("rt-y")]);
    expect(c.n).toBe(2);
  });
});
