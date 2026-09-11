import { describe, it, expect } from "vitest";
import {
  parseFilters,
  filtersToSearchParams,
  filtersToQuery,
  activeFacetCount,
  hasAnyFilter,
  prazoRange,
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
