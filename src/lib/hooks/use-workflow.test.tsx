import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkflowWrite } from "./use-workflow";
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { post } }));
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return renderHook(({ taskId }) => useWorkflowWrite(taskId), { initialProps: { taskId: "t1" }, wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}
beforeEach(() => post.mockReset());
describe("workflow operation retry", () => {
  it("reuses operation and original version after unknown response, even after polling advances version", async () => {
    post.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ data: { state: {} } });
    const { result } = setup();
    const command = { type: "transition" as const, to: "READY" as const };
    await act(async () => { await expect(result.current.mutateAsync({ kind: "commands", expectedVersion: 2, command })).rejects.toThrow("network"); });
    await act(async () => { await result.current.mutateAsync({ kind: "commands", expectedVersion: 3, command }); });
    expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
    expect(post.mock.calls[1][1].expectedVersion).toBe(2);
    await act(async () => { await result.current.mutateAsync({ kind: "commands", expectedVersion: 4, command }); });
    expect(post.mock.calls[2][1].operationId).not.toBe(post.mock.calls[0][1].operationId);
  });
  it("never reuses the old task endpoint when the hook target changes", async () => {
    post.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ data: { state: {} } });
    const { result, rerender } = setup();
    const command = { type: "transition" as const, to: "READY" as const };
    await act(async () => { await expect(result.current.mutateAsync({ kind: "commands", expectedVersion: 2, command })).rejects.toThrow("network"); });
    rerender({ taskId: "t2" });
    await act(async () => { await result.current.mutateAsync({ kind: "commands", expectedVersion: 2, command }); });
    expect(post.mock.calls[1][0]).toBe("/tasks/t2/workflow/commands");
    expect(post.mock.calls[1][1].operationId).not.toBe(post.mock.calls[0][1].operationId);
  });
  it("uses current version for a new attempt after explicit conflict", async () => {
    post.mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValue({ data: { state: {} } });
    const { result } = setup();
    const command = { type: "transition" as const, to: "READY" as const };
    await act(async () => { await expect(result.current.mutateAsync({ kind: "commands", expectedVersion: 2, command })).rejects.toEqual({ response: { status: 409 } }); });
    await act(async () => { await result.current.mutateAsync({ kind: "commands", expectedVersion: 3, command }); });
    expect(post.mock.calls[1][1].expectedVersion).toBe(3);
    expect(post.mock.calls[1][1].operationId).not.toBe(post.mock.calls[0][1].operationId);
  });
});
