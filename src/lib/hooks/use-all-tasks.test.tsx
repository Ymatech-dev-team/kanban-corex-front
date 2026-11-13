import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAllTasks } from "./use-all-tasks";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { get } }));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn() } }));

function run(query: Record<string, string>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useAllTasks(query), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}
beforeEach(() => { get.mockReset(); get.mockResolvedValue({ data: { tasks: [], hasMore: false } }); });

describe("useAllTasks — q (RB4)", () => {
  it("envia q aparada", async () => {
    const { result } = run({ q: "  boas-vindas  ", cliente: "c1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith("/tasks", { params: { cliente: "c1", q: "boas-vindas" } });
  });
  it("omite q vazia ou só espaços (o backend responde 400 a q vazia)", async () => {
    for (const q of ["", "   "]) {
      get.mockClear();
      const { result } = run({ q, cliente: "c1" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(get.mock.calls[0][1]).toEqual({ params: { cliente: "c1" } });
    }
  });
  it("sem q, os parâmetros seguem iguais", async () => {
    const { result } = run({ cliente: "c1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith("/tasks", { params: { cliente: "c1" } });
  });
});
