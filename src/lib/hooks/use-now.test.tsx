import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "./use-now";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T15:00:00Z")); setVisibility("visible"); });
afterEach(() => { vi.useRealTimers(); });

describe("useNow", () => {
  it("renova a cada intervalo", () => {
    const { result } = renderHook(() => useNow(30_000));
    const first = result.current.getTime();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.getTime()).toBe(first + 30_000);
  });
  it("não renova antes do intervalo", () => {
    const { result } = renderHook(() => useNow(30_000));
    const first = result.current.getTime();
    act(() => { vi.advanceTimersByTime(29_000); });
    expect(result.current.getTime()).toBe(first);
  });
  it("pausa com a aba oculta e atualiza na volta", () => {
    const { result } = renderHook(() => useNow(30_000));
    const first = result.current.getTime();
    act(() => { setVisibility("hidden"); });
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(result.current.getTime()).toBe(first);
    act(() => { setVisibility("visible"); });
    expect(result.current.getTime()).toBe(first + 120_000);
  });
  it("intervalo 0 não cria timer nem listener de visibilidade", () => {
    const add = vi.spyOn(document, "addEventListener");
    const { result } = renderHook(() => useNow(0));
    const first = result.current.getTime();
    expect(vi.getTimerCount()).toBe(0);
    expect(add.mock.calls.some(([type]) => type === "visibilitychange")).toBe(false);
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(result.current.getTime()).toBe(first);
    add.mockRestore();
  });
  it("limpa timer e listener ao desmontar", () => {
    const { unmount } = renderHook(() => useNow(30_000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
