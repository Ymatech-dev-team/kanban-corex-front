import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowTeamItem } from "@sistema-tasks/contracts";
import { teamWorkflowsKey, useTeamWorkflows } from "./use-workflow";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { get } }));

const item = (n: number): WorkflowTeamItem => ({ taskId: `t${n}`, title: `Tarefa ${n}`, clientId: "c", clientName: "Cliente", projectId: "p", projectName: "Projeto", responsibleName: null, assigneeName: null, updatedAt: "2026-11-12T12:00:00Z", state: {} as WorkflowTeamItem["state"] });
const page = (from: number, count: number, next: string | null) => ({ data: { items: Array.from({ length: count }, (_, i) => item(from + i)), nextCursor: next } });

function setup(options?: { enabled?: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...renderHook(() => useTeamWorkflows(options), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }) };
}
// Chaves obrigatórias: beforeEach que devolve o mock o executaria como teardown (e uma rejeição persistida derrubaria o teste).
beforeEach(() => { get.mockReset(); });

describe("useTeamWorkflows", () => {
  it("chama GET tasks/workflows/team com limit 100 e junta páginas até o cursor acabar", async () => {
    get.mockResolvedValueOnce(page(0, 100, "c1")).mockResolvedValueOnce(page(100, 30, null));
    const { result } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(130));
    expect(get.mock.calls[0]).toEqual(["/tasks/workflows/team", { params: { limit: 100 } }]);
    expect(get.mock.calls[1]).toEqual(["/tasks/workflows/team", { params: { limit: 100, cursor: "c1" } }]);
    expect(result.current.truncated).toBe(false);
    expect(get).toHaveBeenCalledTimes(2);
  });
  it("para em 300 itens e avisa que há mais", async () => {
    get.mockResolvedValueOnce(page(0, 100, "c1")).mockResolvedValueOnce(page(100, 100, "c2")).mockResolvedValueOnce(page(200, 100, "c3"));
    const { result } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(300));
    await waitFor(() => expect(result.current.truncated).toBe(true));
    expect(get).toHaveBeenCalledTimes(3);
  });
  it("remove duplicatas entre páginas", async () => {
    get.mockResolvedValueOnce(page(0, 3, "c1")).mockResolvedValueOnce(page(2, 3, null));
    const { result } = setup();
    await waitFor(() => expect(result.current.items.map(i => i.taskId)).toEqual(["t0", "t1", "t2", "t3", "t4"]));
  });
  it("N5: página vazia ou curta com nextCursor não encerra; só nextCursor null encerra", async () => {
    get.mockResolvedValueOnce(page(0, 0, "c1")).mockResolvedValueOnce(page(0, 2, "c2")).mockResolvedValueOnce(page(2, 0, "c3")).mockResolvedValueOnce(page(2, 1, null));
    const { result } = setup();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(result.current.items.map(i => i.taskId)).toEqual(["t0", "t1", "t2"]));
    expect(get.mock.calls[3][1]).toEqual({ params: { limit: 100, cursor: "c3" } });
    expect(result.current.hasNextPage).toBe(false);
  });
  it("não chama a API com enabled false", async () => {
    const { result } = setup({ enabled: false });
    await new Promise(r => setTimeout(r, 20));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });
  async function failAfterSuccess(failure: unknown) {
    get.mockResolvedValueOnce(page(0, 3, null)).mockRejectedValue(failure);
    const hook = setup();
    await waitFor(() => expect(hook.result.current.items).toHaveLength(3));
    await act(async () => { await hook.client.invalidateQueries({ queryKey: teamWorkflowsKey }); });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    return hook.result.current;
  }
  it.each([401, 403, 404])("S5: acesso revogado (%i) esvazia o feed", async (status) => {
    const out = await failAfterSuccess({ response: { status } });
    expect(out.items).toEqual([]);
    expect(out.data).toBeUndefined();
    expect(out.truncated).toBe(false);
  });
  it("S5: 5xx mantém o último estado", async () => {
    const out = await failAfterSuccess({ response: { status: 500 } });
    expect(out.items).toHaveLength(3);
    expect(out.data?.pages).toHaveLength(1);
  });
  it("S5: erro de rede mantém o último estado", async () => {
    expect((await failAfterSuccess({ message: "Network Error", code: "ERR_NETWORK" })).items).toHaveLength(3);
  });
  it("não insiste em páginas após erro", async () => {
    get.mockResolvedValueOnce(page(0, 100, "c1")).mockRejectedValueOnce({ response: { status: 500 } });
    const { result } = setup();
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    await new Promise(r => setTimeout(r, 30));
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.items).toHaveLength(100);
  });
});
