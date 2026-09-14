import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// toast estável entre re-imports (resetModules recria o módulo, não o spy). [fix jornada-token]
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

type ErrLike = {
  response?: { status?: number; data?: { error?: { code?: string } } };
  config?: { url?: string; method?: string };
};
function err(status: number, url: string, opts?: { code?: string; method?: string }): ErrLike {
  return {
    response: { status, data: opts?.code ? { error: { code: opts.code } } : undefined },
    config: { url, method: opts?.method ?? "get" },
  };
}

function setLocation(pathname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname, href: "" } as Location,
  });
}

async function load() {
  vi.resetModules(); // zera o sessionRecovering (module-level) a cada teste
  return (await import("./api")).onResponseError;
}

describe("onResponseError — auto-cura de sessão", () => {
  beforeEach(() => {
    toastError.mockClear();
    vi.useFakeTimers();
    setLocation("/tarefas");
  });
  afterEach(() => vi.useRealTimers());

  it("401 numa request de dados → avisa e redireciona pro /login", async () => {
    const onErr = await load();
    const e = err(401, "/tasks/t1/move");
    await expect(onErr(e)).rejects.toBe(e);
    expect(toastError).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(window.location.href).toBe("/login");
  });

  it("401 no GET /me NÃO redireciona (poll do AuthGuard, sem toast)", async () => {
    const onErr = await load();
    await expect(onErr(err(401, "/me"))).rejects.toBeDefined();
    vi.runAllTimers();
    expect(toastError).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("401 numa mutação de /me (editar/excluir conta) redireciona", async () => {
    const onErr = await load();
    const e = err(401, "/me", { method: "patch" });
    await expect(onErr(e)).rejects.toBe(e);
    expect(toastError).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(window.location.href).toBe("/login");
  });

  it("401 em /auth/* NÃO redireciona (login tem erro próprio)", async () => {
    const onErr = await load();
    await expect(onErr(err(401, "/auth/login"))).rejects.toBeDefined();
    vi.runAllTimers();
    expect(toastError).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("401 já estando em /login NÃO redireciona (evita loop)", async () => {
    setLocation("/login");
    const onErr = await load();
    await expect(onErr(err(401, "/tasks"))).rejects.toBeDefined();
    vi.runAllTimers();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("401 duas vezes → só um toast/redirect (sessionRecovering)", async () => {
    const onErr = await load();
    await expect(onErr(err(401, "/tasks"))).rejects.toBeDefined();
    await expect(onErr(err(401, "/projects"))).rejects.toBeDefined();
    expect(toastError).toHaveBeenCalledOnce();
  });

  it("403 CSRF continua redirecionando (regressão)", async () => {
    const onErr = await load();
    const e = err(403, "/tasks", { code: "CSRF" });
    await expect(onErr(e)).rejects.toBe(e);
    expect(toastError).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(window.location.href).toBe("/login");
  });

  it("403 de permissão (sem CSRF) NÃO redireciona", async () => {
    const onErr = await load();
    await expect(onErr(err(403, "/projects/p1"))).rejects.toBeDefined();
    vi.runAllTimers();
    expect(toastError).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("500 não mexe na sessão", async () => {
    const onErr = await load();
    await expect(onErr(err(500, "/tasks"))).rejects.toBeDefined();
    vi.runAllTimers();
    expect(toastError).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });
});
