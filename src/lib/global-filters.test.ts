import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseFilters,
  filtersToSearchParams,
  filtersToQuery,
  activeFacetCount,
  hasAnyFilter,
  prazoRange,
  readStoredClientProject,
  writeStoredClientProject,
  readSavedViews,
  writeSavedViews,
  builtinViews,
  matchView,
  FLUXO_KINDS,
  filterByFluxo,
  type GlobalFilters,
} from "./global-filters";

const NOW = new Date(2026, 8, 10, 9, 0, 0); // 10/set/2026 09h local

describe("parseFilters", () => {
  it("vazio → default ATIVAS, resto undefined", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({ status: "ATIVAS" });
  });
  it("lê valores válidos", () => {
    const sp = new URLSearchParams("cliente=c1&projeto=e1&resp=u1&status=DONE&prio=HIGH&prazo=hoje");
    expect(parseFilters(sp)).toEqual({ cliente: "c1", projeto: "e1", resp: "u1", status: "DONE", prio: "HIGH", prazo: "hoje" });
  });
  it("valores inválidos caem no default/undefined (não quebra)", () => {
    const sp = new URLSearchParams("status=LIXO&prio=URGENTE&prazo=ontem");
    expect(parseFilters(sp)).toEqual({ status: "ATIVAS" });
  });
});

describe("filtersToSearchParams — só grava o que difere do default", () => {
  it("default gera URL vazia", () => {
    expect(filtersToSearchParams({ status: "ATIVAS" }).toString()).toBe("");
  });
  it("roundtrip", () => {
    const f: GlobalFilters = { cliente: "c1", resp: "u1", status: "DOING", prazo: "atrasadas" };
    expect(parseFilters(filtersToSearchParams(f))).toMatchObject(f);
  });
});

describe("filtersToQuery — mapeia pro GET /tasks", () => {
  it("ATIVAS não manda status nem includeDone", () => {
    expect(filtersToQuery({ status: "ATIVAS" })).toEqual({});
  });
  it("TODAS manda includeDone=true", () => {
    expect(filtersToQuery({ status: "TODAS" })).toEqual({ includeDone: "true" });
  });
  it("status concreto vira status=…", () => {
    expect(filtersToQuery({ status: "DONE" })).toEqual({ status: "DONE" });
  });
  it("cliente/projeto/resp/prio mapeiam", () => {
    expect(filtersToQuery({ status: "ATIVAS", cliente: "c1", projeto: "e1", resp: "u1", prio: "HIGH" })).toEqual({
      projectId: "c1", engagementId: "e1", assigneeId: "u1", priority: "HIGH",
    });
  });
  it("prazo=hoje cobre o dia inteiro (00:00..23:59)", () => {
    const q = filtersToQuery({ status: "ATIVAS", prazo: "hoje" }, NOW);
    expect(new Date(q.dueFrom!).getDate()).toBe(10);
    expect(new Date(q.dueTo!).getDate()).toBe(10);
    expect(new Date(q.dueFrom!).getTime()).toBeLessThan(new Date(q.dueTo!).getTime());
  });
  it("prazo=atrasadas manda só dueTo (fim da véspera)", () => {
    const q = filtersToQuery({ status: "ATIVAS", prazo: "atrasadas" }, NOW);
    expect(q.dueFrom).toBeUndefined();
    expect(new Date(q.dueTo!).getDate()).toBe(9);
  });
});

describe("contadores", () => {
  it("activeFacetCount conta status≠ATIVAS + prio + prazo (não conta cliente/resp)", () => {
    expect(activeFacetCount({ status: "ATIVAS" })).toBe(0);
    expect(activeFacetCount({ status: "DONE", prio: "HIGH", prazo: "hoje", cliente: "c1", resp: "u1" })).toBe(3);
  });
  it("hasAnyFilter pega qualquer eixo", () => {
    expect(hasAnyFilter({ status: "ATIVAS" })).toBe(false);
    expect(hasAnyFilter({ status: "ATIVAS", cliente: "c1" })).toBe(true);
    expect(hasAnyFilter({ status: "TODAS" })).toBe(true);
  });
});

describe("prazoRange", () => {
  it("semana = hoje..+6", () => {
    const r = prazoRange("semana", NOW);
    expect(new Date(r.dueFrom!).getDate()).toBe(10);
    expect(new Date(r.dueTo!).getDate()).toBe(16);
  });
});

describe("readStoredClientProject / writeStoredClientProject", () => {
  const KEY = "sdt_tarefas_filtros";
  beforeEach(() => localStorage.clear());

  it("round-trip cliente+projeto", () => {
    writeStoredClientProject("c1", "e1");
    expect(readStoredClientProject()).toEqual({ cliente: "c1", projeto: "e1" });
  });
  it("cliente sem projeto", () => {
    writeStoredClientProject("c1");
    expect(readStoredClientProject()).toEqual({ cliente: "c1", projeto: undefined });
  });
  it("sem cliente limpa o storage", () => {
    writeStoredClientProject("c1", "e1");
    writeStoredClientProject(undefined, "e1"); // ex.: "Limpar filtros"
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(readStoredClientProject()).toEqual({});
  });
  it("trocar de cliente não gruda o projeto antigo", () => {
    writeStoredClientProject("c1", "e1");
    writeStoredClientProject("c2"); // trocou de cliente, sem projeto
    expect(readStoredClientProject()).toEqual({ cliente: "c2", projeto: undefined });
  });
  it("descarta projeto órfão (sem cliente)", () => {
    localStorage.setItem(KEY, JSON.stringify({ projeto: "e1" }));
    expect(readStoredClientProject()).toEqual({ cliente: undefined, projeto: undefined });
  });
  it("JSON corrompido → vazio (não quebra)", () => {
    localStorage.setItem(KEY, "{lixo");
    expect(readStoredClientProject()).toEqual({});
  });
  it("ausente → vazio", () => {
    expect(readStoredClientProject()).toEqual({});
  });
});

describe("q e fluxo (RF22/RF23)", () => {
  it("URL ida e volta preserva q e fluxo", () => {
    const f: GlobalFilters = { status: "ATIVAS", q: "contrato", fluxo: "voce", cliente: "c1" };
    const sp = filtersToSearchParams(f);
    expect(sp.get("q")).toBe("contrato");
    expect(sp.get("fluxo")).toBe("voce");
    expect(parseFilters(new URLSearchParams(sp.toString()))).toEqual(f);
  });
  it("q vazio ou só espaços não vai para a URL nem para a API", () => {
    expect(parseFilters(new URLSearchParams("q=%20%20"))).toEqual({ status: "ATIVAS" });
    expect(filtersToSearchParams({ status: "ATIVAS", q: "   " }).has("q")).toBe(false);
    expect(filtersToQuery({ status: "ATIVAS", q: "   " })).toEqual({});
  });
  it("q é aparado e limitado a 100 caracteres (o backend responde 400 acima disso)", () => {
    expect(parseFilters(new URLSearchParams("q=%20ab%20")).q).toBe("ab");
    expect(parseFilters(new URLSearchParams(`q=${"x".repeat(150)}`)).q).toHaveLength(100);
  });
  it("q vai para a API; fluxo NÃO vai (filtro no cliente)", () => {
    expect(filtersToQuery({ status: "ATIVAS", q: "login", fluxo: "rodando" })).toEqual({ q: "login" });
  });
  it("fluxo inválido é descartado", () => {
    expect(parseFilters(new URLSearchParams("fluxo=lixo")).fluxo).toBeUndefined();
  });
  it("q e fluxo contam como filtro; fluxo conta como faceta do popover, q não", () => {
    expect(hasAnyFilter({ status: "ATIVAS", q: "a" })).toBe(true);
    expect(hasAnyFilter({ status: "ATIVAS", fluxo: "parado" })).toBe(true);
    expect(activeFacetCount({ status: "ATIVAS", q: "a", fluxo: "parado" })).toBe(1);
  });
  it("cada fluxo cobre estados vivos distintos", () => {
    expect(FLUXO_KINDS.rodando).toEqual(["running"]);
    expect(FLUXO_KINDS.voce).toEqual(["you"]);
    expect(FLUXO_KINDS.revisao).toEqual(["review"]);
    expect(FLUXO_KINDS.parado).toEqual(expect.arrayContaining(["silent", "blocked", "paused", "changes"]));
  });
});

describe("visões (RF19/RF24)", () => {
  const KEY = "sdt_tarefas_visoes:u1";
  beforeEach(() => localStorage.clear());

  it("visões embutidas são conjuntos de params e a ativa é a que bate exatamente", () => {
    const views = builtinViews("u1");
    expect(views.map((v) => v.label)).toEqual(["Ativas", "Minhas", "Rodando", "Esperando você", "Atrasadas"]);
    expect(matchView(views, { status: "ATIVAS" })?.id).toBe("ativas");
    expect(matchView(views, { status: "ATIVAS", resp: "u1" })?.id).toBe("minhas");
    expect(matchView(views, { status: "ATIVAS", fluxo: "rodando" })?.id).toBe("rodando");
    expect(matchView(views, { status: "ATIVAS", fluxo: "voce" })?.id).toBe("voce");
    expect(matchView(views, { status: "ATIVAS", prazo: "atrasadas" })?.id).toBe("atrasadas");
    expect(matchView(views, { status: "ATIVAS", prio: "HIGH" })).toBeUndefined();
  });
  it("sem usuário conhecido, Minhas some", () => {
    expect(builtinViews(undefined).some((v) => v.id === "minhas")).toBe(false);
  });
  it("round-trip das visões salvas no localStorage", () => {
    expect(writeSavedViews("u1", [{ id: "v1", name: "IMA esta semana", params: "cliente=c1&prazo=semana" }])).toBe(true);
    expect(readSavedViews("u1")).toEqual([{ id: "v1", name: "IMA esta semana", params: "cliente=c1&prazo=semana" }]);
  });
  it("storage corrompido ou com formato inválido → só as embutidas (lista vazia)", () => {
    localStorage.setItem(KEY, "{lixo");
    expect(readSavedViews("u1")).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    expect(readSavedViews("u1")).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify([{ id: 1, name: "x" }, { id: "ok", name: "Boa", params: "prio=HIGH" }]));
    expect(readSavedViews("u1")).toEqual([{ id: "ok", name: "Boa", params: "prio=HIGH" }]);
  });
  it("storage que lança erro é tolerado na leitura e na escrita", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readSavedViews("u1")).toEqual([]);
    expect(writeSavedViews("u1", [{ id: "v", name: "n", params: "" }])).toBe(false);
    get.mockRestore();
    set.mockRestore();
  });
  it("cada usuário tem as suas visões; a chave antiga sem usuário é ignorada", () => {
    writeSavedViews("u1", [{ id: "a", name: "Da Ana", params: "prio=HIGH" }]);
    writeSavedViews("u2", [{ id: "b", name: "Do Caio", params: "cliente=c9" }]);
    expect(readSavedViews("u1").map((v) => v.name)).toEqual(["Da Ana"]);
    expect(readSavedViews("u2").map((v) => v.name)).toEqual(["Do Caio"]);
    localStorage.setItem("sdt_tarefas_visoes", JSON.stringify([{ id: "old", name: "Legada", params: "" }]));
    expect(readSavedViews("u3")).toEqual([]);
  });
  it("sem usuário não lê nem grava", () => {
    writeSavedViews("u1", [{ id: "a", name: "Da Ana", params: "" }]);
    expect(readSavedViews(undefined)).toEqual([]);
    expect(writeSavedViews(undefined, [{ id: "x", name: "x", params: "" }])).toBe(false);
    expect(localStorage.length).toBe(1);
  });
  it("visão salva é achada pelos mesmos params", () => {
    const saved = [{ id: "v1", name: "Alta", params: "prio=HIGH" }];
    expect(matchView([...builtinViews("u1"), ...saved.map((s) => ({ id: s.id, label: s.name, filters: parseFilters(new URLSearchParams(s.params)) }))], { status: "ATIVAS", prio: "HIGH" })?.id).toBe("v1");
  });
});

describe("filterByFluxo (RF23)", () => {
  const tasks = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "manual" }];
  const live = { a: { kind: "running" as const }, b: { kind: "you" as const }, c: { kind: "silent" as const }, d: { kind: "review" as const } };
  it("sem fluxo ativo passa tudo, inclusive tarefas sem fluxo", () => {
    expect(filterByFluxo(tasks, live)).toHaveLength(5);
  });
  it("com fluxo ativo, tarefa sem fluxo some", () => {
    expect(filterByFluxo(tasks, live, "rodando").map((t) => t.id)).toEqual(["a"]);
    expect(filterByFluxo(tasks, live, "voce").map((t) => t.id)).toEqual(["b"]);
    expect(filterByFluxo(tasks, live, "revisao").map((t) => t.id)).toEqual(["d"]);
  });
  it("parado inclui sem sinal, bloqueada, pausada e ajustes pedidos", () => {
    expect(filterByFluxo(tasks, live, "parado").map((t) => t.id)).toEqual(["c"]);
  });
  it("com fluxo ativo e sem nenhum fluxo conhecido, a lista fica vazia", () => {
    expect(filterByFluxo(tasks, {}, "rodando")).toEqual([]);
  });
});
