import { beforeEach, describe, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn(), get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("./env", () => ({ IS_PROD: true }));
import { setSession, setCsrf, clearSession, AT, RT, CSRF } from "./session";
beforeEach(() => { vi.clearAllMocks(); jar.get.mockReturnValue({ value: "existing-csrf" }); });
describe("persistent session cookies", () => {
 it("persists access and refresh with secure limits and renews existing CSRF", async () => {
  await setSession("access", "refresh");
  expect(jar.set).toHaveBeenCalledWith(AT,"access",expect.objectContaining({maxAge:900,httpOnly:true,secure:true,sameSite:"lax"}));
  expect(jar.set).toHaveBeenCalledWith(RT,"refresh",expect.objectContaining({maxAge:604800,httpOnly:true,secure:true,sameSite:"strict"}));
  expect(jar.set).toHaveBeenCalledWith(CSRF,"existing-csrf",expect.objectContaining({maxAge:604800,httpOnly:false}));
 });
 it("persists initial CSRF; logout removes every cookie", async () => {
  await setCsrf("csrf"); expect(jar.set).toHaveBeenCalledWith(CSRF,"csrf",expect.objectContaining({maxAge:604800}));
  await clearSession(); expect(jar.delete.mock.calls.map(c=>c[0])).toEqual([AT,RT,CSRF]);
 });
});
